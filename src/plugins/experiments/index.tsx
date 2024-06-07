/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { ErrorCard } from "@components/ErrorCard";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Forms, React } from "@webpack/common";

import hideBugReport from "./hideBugReport.css?managed";

const KbdStyles = findByPropsLazy("key", "removeBuildOverride");

export default definePlugin({
    name: "実験",
    description: "Discordでの実験へのアクセスを有効にします！",
    authors: [
        Devs.Megu,
        Devs.Ven,
        Devs.Nickyux,
        Devs.BanTheNons,
        Devs.Nuckyz
    ],

    patches: [
        {
            find: "Object.defineProperties(this,{isDeveloper",
            replacement: {
                match: /(?<={isDeveloper:\{[^}]+?,get:\(\)=>)\i/,
                replace: "true"
            }
        },
        {
            find: 'type:"user",revision',
            replacement: {
                match: /!(\i)&&"CONNECTION_OPEN".+?;/g,
                replace: "$1=!0;"
            }
        },
        {
            find: 'H1,title:"Experiments"',
            replacement: {
                match: 'title:"Experiments",children:[',
                replace: "$&$self.WarningCard(),"
            }
        },
        // change top right chat toolbar button from the help one to the dev one
        {
            find: "toolbar:function",
            replacement: {
                match: /\i\.isStaff\(\)/,
                replace: "true"
            }
        }
    ],

    start: () => enableStyle(hideBugReport),
    stop: () => disableStyle(hideBugReport),

    settingsAboutComponent: () => {
        const isMacOS = navigator.platform.includes("Mac");
        const modKey = isMacOS ? "cmd" : "ctrl";
        const altKey = isMacOS ? "opt" : "alt";
        return (
            <React.Fragment>
                <Forms.FormTitle tag="h3">詳細情報</Forms.FormTitle>
                <Forms.FormText variant="text-md/normal">
                    You can enable client DevTools{" "}
                    <kbd className={KbdStyles.key}>{modKey}</kbd> +{" "}
                    <kbd className={KbdStyles.key}>{altKey}</kbd> +{" "}
                    <kbd className={KbdStyles.key}>O</kbd>{" "}
                    after enabling <code>isStaff</code> below
                </Forms.FormText>
                <Forms.FormText>
                    and then toggling <code>Enable DevTools</code> in the <code>Developer Options</code> tab in settings.
                </Forms.FormText>
            </React.Fragment>
        );
    },

    WarningCard: ErrorBoundary.wrap(() => (
        <ErrorCard id="vc-experiments-warning-card" className={Margins.bottom16}>
            <Forms.FormTitle tag="h2">ちょっと待って!!</Forms.FormTitle>

            <Forms.FormText>
                実験はリリースされていないDiscordの機能です。それらは動作しないか、あなたのクライアントを壊すか、あなたのアカウントを無効にする可能性があります。
            </Forms.FormText>

            <Forms.FormText className={Margins.top8}>
                Only use experiments if you know what you're doing. Vencord is not responsible for any damage caused by enabling experiments.
            </Forms.FormText>
        </ErrorCard>
    ), { noop: true })
});
