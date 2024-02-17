/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { makeRange } from "@components/PluginSettings/components";
import { Devs } from "@utils/constants";
import { debounce } from "@utils/debounce";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, Menu, React, ReactDOM } from "@webpack/common";
import type { Root } from "react-dom/client";

import { Magnifier, MagnifierProps } from "./components/Magnifier";
import { ELEMENT_ID } from "./constants";
import styles from "./styles.css?managed";

export const settings = definePluginSettings({
    saveZoomValues: {
        type: OptionType.BOOLEAN,
        description: "ズームとレンズサイズの値を保存するかどうか",
        default: true,
    },

    invertScroll: {
        type: OptionType.BOOLEAN,
        description: "スクロールを反転する",
        default: true,
    },

    nearestNeighbour: {
        type: OptionType.BOOLEAN,
        description: "画像を拡大するときに最近傍補間を使用する",
        default: false,
    },

    square: {
        type: OptionType.BOOLEAN,
        description: "レンズを四角にする",
        default: false,
    },

    zoom: {
        description: "レンズのズーム",
        type: OptionType.SLIDER,
        markers: makeRange(1, 50, 4),
        default: 2,
        stickToMarkers: false,
    },
    size: {
        description: "レンズの半径 / サイズ",
        type: OptionType.SLIDER,
        markers: makeRange(50, 1000, 50),
        default: 100,
        stickToMarkers: false,
    },

    zoomSpeed: {
        description: "ズーム / レンズサイズの変化速度",
        type: OptionType.SLIDER,
        markers: makeRange(0.1, 5, 0.2),
        default: 0.5,
        stickToMarkers: false,
    },
});

const imageContextMenuPatch: NavContextMenuPatchCallback = children => () => {
    children.push(
        <Menu.MenuGroup id="image-zoom">
            <Menu.MenuCheckboxItem
                id="vc-square"
                label="四角いレンズ"
                checked={settings.store.square}
                action={() => {
                    settings.store.square = !settings.store.square;
                    ContextMenuApi.closeContextMenu();
                }}
            />
            <Menu.MenuCheckboxItem
                id="vc-nearest-neighbour"
                label="最近傍補間"
                checked={settings.store.nearestNeighbour}
                action={() => {
                    settings.store.nearestNeighbour = !settings.store.nearestNeighbour;
                    ContextMenuApi.closeContextMenu();
                }}
            />
            <Menu.MenuControlItem
                id="vc-zoom"
                label="ズーム"
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={1}
                        maxValue={50}
                        value={settings.store.zoom}
                        onChange={debounce((value: number) => settings.store.zoom = value, 100)}
                    />
                )}
            />
            <Menu.MenuControlItem
                id="vc-size"
                label="レンズサイズ"
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={50}
                        maxValue={1000}
                        value={settings.store.size}
                        onChange={debounce((value: number) => settings.store.size = value, 100)}
                    />
                )}
            />
            <Menu.MenuControlItem
                id="vc-zoom-speed"
                label="ズーム速度"
                control={(props, ref) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0.1}
                        maxValue={5}
                        value={settings.store.zoomSpeed}
                        onChange={debounce((value: number) => settings.store.zoomSpeed = value, 100)}
                        renderValue={(value: number) => `${value.toFixed(3)}x`}
                    />
                )}
            />
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "画像ズーム",
    description: "画像やGIFを拡大表示することができます。ズームインするにはスクロールホイールを、レンズの半径/サイズを増やすにはシフト+スクロールホイールを使用します",
    authors: [Devs.Aria],
    tags: ["画像ユーティリティ"],

    patches: [
        {
            find: "Messages.OPEN_IN_BROWSER",
            replacement: {
                match: /return.{1,200}\.wrapper.{1,200}src:\i,/g,
                replace: `$&id: '${ELEMENT_ID}',`
            }
        },

        {
            find: "handleImageLoad=",
            replacement: [
                {
                    match: /placeholderVersion:\i,/,
                    replace: "...$self.makeProps(this),$&"
                },

                {
                    match: /componentDidMount\(\){/,
                    replace: "$&$self.renderMagnifier(this);",
                },

                {
                    match: /componentWillUnmount\(\){/,
                    replace: "$&$self.unMountMagnifier();"
                }
            ]
        },
        {
            find: ".carouselModal",
            replacement: {
                match: /(?<=\.carouselModal.{0,100}onClick:)\i,/,
                replace: "()=>{},"
            }
        }
    ],

    settings,

    currentMagnifierElement: null as React.FunctionComponentElement<MagnifierProps & JSX.IntrinsicAttributes> | null,
    element: null as HTMLDivElement | null,

    Magnifier,
    root: null as Root | null,
    makeProps(instance) {
        return {
            onMouseOver: () => this.onMouseOver(instance),
            onMouseOut: () => this.onMouseOut(instance),
            onMouseDown: (e: React.MouseEvent) => this.onMouseDown(e, instance),
            onMouseUp: () => this.onMouseUp(instance),
            id: instance.props.id,
        };
    },

    renderMagnifier(instance) {
        if (instance.props.id === ELEMENT_ID) {
            if (!this.currentMagnifierElement) {
                this.currentMagnifierElement = <Magnifier size={settings.store.size} zoom={settings.store.zoom} instance={instance} />;
                this.root = ReactDOM.createRoot(this.element!);
                this.root.render(this.currentMagnifierElement);
            }
        }
    },

    unMountMagnifier() {
        this.root?.unmount();
        this.currentMagnifierElement = null;
        this.root = null;
    },

    onMouseOver(instance) {
        instance.setState((state: any) => ({ ...state, mouseOver: true }));
    },
    onMouseOut(instance) {
        instance.setState((state: any) => ({ ...state, mouseOver: false }));
    },
    onMouseDown(e: React.MouseEvent, instance) {
        if (e.button === 0 /* left */)
            instance.setState((state: any) => ({ ...state, mouseDown: true }));
    },
    onMouseUp(instance) {
        instance.setState((state: any) => ({ ...state, mouseDown: false }));
    },

    start() {
        enableStyle(styles);
        addContextMenuPatch("image-context", imageContextMenuPatch);
        this.element = document.createElement("div");
        this.element.classList.add("MagnifierContainer");
        document.body.appendChild(this.element);
    },

    stop() {
        disableStyle(styles);
        this.root && this.root.unmount();
        this.element?.remove();
        removeContextMenuPatch("image-context", imageContextMenuPatch);
    }
});
