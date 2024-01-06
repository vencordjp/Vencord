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

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "追跡を削除",
    description: "Discordの追跡を無効にします。（'science'）、メトリクスとセントリークラッシュレポート",
    authors: [Devs.Cyn, Devs.Ven, Devs.Nuckyz, Devs.Arrow],
    required: true,
    patches: [
        {
            find: "AnalyticsActionHandlers.handle",
            replacement: {
                match: /^.+$/,
                replace: "()=>{}",
            },
        },
        {
            find: "window.DiscordSentry=",
            replacement: {
                match: /^.+$/,
                replace: "()=>{}",
            }
        },
        {
            find: ".METRICS,",
            replacement: [
                {
                    match: /this\._intervalId=/,
                    replace: "this._intervalId=undefined&&"
                },
                {
                    match: /(increment\(\i\){)/,
                    replace: "$1return;"
                }
            ]
        },
        {
            find: ".installedLogHooks)",
            replacement: {
                // if getDebugLogging() returns false, the hooks don't get installed.
                match: "getDebugLogging(){",
                replace: "getDebugLogging(){return false;"
            }
        },
    ]
});
