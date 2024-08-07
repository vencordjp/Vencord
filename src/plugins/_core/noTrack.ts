/*
 * Vencord、Discordのデスクトップアプリのための改造
 * Copyright (c) 2022 Vendicatedとその貢献者
 *
 * このプログラムはフリーソフトウェアです: あなたはそれを再配布することができ、または
 * Free Software Foundationによって公開されたGNU General Public Licenseの
 * 条件の下でそれを変更することができます、ライセンスのバージョン3、または
 * （あなたの選択により）任意の後のバージョン。
 *
 * このプログラムは有用であることを期待して配布されます、
 * しかし、何の保証もありません; さらには商品性または特定の目的への適合性の黙示的な保証もありません。
 * 詳細についてはGNU General Public Licenseを参照してください。
 *
 * あなたはこのプログラムと一緒にGNU General Public Licenseのコピーを受け取るべきでした。
 * そうでない場合は、<https://www.gnu.org/licenses/>を参照してください。
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, StartAt } from "@utils/types";

const settings = definePluginSettings({
    disableAnalytics: {
        type: OptionType.BOOLEAN,
        description: "Disable Discord's tracking (analytics/'science')",
        default: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "NoTrack",
    description: "Discordのトラッキング（アナリティクス/'science'）、メトリクス、Sentryクラッシュレポートを無効にする",
    authors: [Devs.Cyn, Devs.Ven, Devs.Nuckyz, Devs.Arrow],
    required: true,

    settings,

    patches: [
        {
            find: "AnalyticsActionHandlers.handle",
            predicate: () => settings.store.disableAnalytics,
            replacement: {
                match: /^.+$/,
                replace: "()=>{}",
            },
        },
        {
            find: ".METRICS,",
            replacement: [
                {
                    match: /this\._intervalId=/,
                    replace: "this._intervalId=void 0&&"
                },
                {
                    match: /(?:increment|distribution)\(\i(?:,\i)?\){/g,
                    replace: "$&return;"
                }
            ]
        },
        {
            find: ".installedLogHooks)",
            replacement: {
                // getDebugLogging()がfalseを返す場合、フックはインストールされません。
                match: "getDebugLogging(){",
                replace: "getDebugLogging(){return false;"
            }
        },
    ],

    startAt: StartAt.Init,
    start() {
        // Sentry is initialized in its own WebpackInstance.
        // It has everything it needs preloaded, so, it doesn't include any chunk loading functionality.
        // Because of that, its WebpackInstance doesnt export wreq.m or wreq.c

        // To circuvent this and disable Sentry we are gonna hook when wreq.g of its WebpackInstance is set.
        // When that happens we are gonna forcefully throw an error and abort everything.
        Object.defineProperty(Function.prototype, "g", {
            configurable: true,

            set(v: any) {
                Object.defineProperty(this, "g", {
                    value: v,
                    configurable: true,
                    enumerable: true,
                    writable: true
                });

                // Ensure this is most likely the Sentry WebpackInstance.
                // Function.g is a very generic property and is not uncommon for another WebpackInstance (or even a React component: <g></g>) to include it
                const { stack } = new Error();
                if (!(stack?.includes("discord.com") || stack?.includes("discordapp.com")) || !String(this).includes("exports:{}") || this.c != null) {
                    return;
                }

                const assetPath = stack?.match(/\/assets\/.+?\.js/)?.[0];
                if (!assetPath) {
                    return;
                }

                const srcRequest = new XMLHttpRequest();
                srcRequest.open("GET", assetPath, false);
                srcRequest.send();

                // Final condition to see if this is the Sentry WebpackInstance
                if (!srcRequest.responseText.includes("window.DiscordSentry=")) {
                    return;
                }

                new Logger("NoTrack", "#8caaee").info("Disabling Sentry by erroring its WebpackInstance");

                Reflect.deleteProperty(Function.prototype, "g");
                Reflect.deleteProperty(window, "DiscordSentry");

                throw new Error("Sentry successfully disabled");
            }
        });

        Object.defineProperty(window, "DiscordSentry", {
            configurable: true,

            set() {
                new Logger("NoTrack", "#8caaee").error("Failed to disable Sentry. Falling back to deleting window.DiscordSentry");

                Reflect.deleteProperty(Function.prototype, "g");
                Reflect.deleteProperty(window, "DiscordSentry");
            }
        });
    }
});
