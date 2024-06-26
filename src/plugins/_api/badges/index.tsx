/*
 * Vencord, Discordのデスクトップアプリのための改造
 * Copyright (c) 2022 Vendicated and contributors
 *
 * このプログラムはフリーソフトウェアです: あなたはそれを再配布することができます、そして/または
 * Free Software Foundationによって公開されたGNU General Public Licenseの
 * 条件の下でそれを変更することができます、ライセンスのバージョン3、または
 * （あなたの選択により）任意の後のバージョン。
 *
 * このプログラムは有用であることを期待して配布されます、
 * しかし、何の保証もありません。 連邦法上の黙示の保証も含めて、
 * 商品性または特定の目的への適合性。 詳細については
 * GNU General Public Licenseを参照してください。
 *
 * あなたはこのプログラムと一緒にGNU General Public Licenseのコピーを
 * 受け取るべきでした。 そうでない場合は、<https://www.gnu.org/licenses/>を参照してください。
*/

import "./fixBadgeOverflow.css";

import { _getBadges, BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import DonateButton from "@components/DonateButton";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heart } from "@components/Heart";
import { openContributorModal } from "@components/PluginSettings/ContributorModal";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { isPluginDev } from "@utils/misc";
import { closeModal, Modals, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Forms, Toasts, UserStore } from "@webpack/common";
import { User } from "discord-types/general";

const CONTRIBUTOR_BADGE = "https://vencord.dev/assets/favicon.png";

const ContributorBadge: ProfileBadge = {
    description: "Vencordの貢献者",
    image: CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => isPluginDev(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId))
};

let DonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
let RaiBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;

async function loadBadges(noCache = false) {
    DonorBadges = {};

    const init = {} as RequestInit;
    if (noCache)
        init.cache = "no-cache";

    DonorBadges = await fetch("https://badges.vencord.dev/badges.json", init)
        .then(r => r.json());

    RaiBadges = {};

    const initA = {} as RequestInit;
    if (noCache)
        initA.cache = "no-cache";

    RaiBadges = await fetch("https://raw.githubusercontent.com/raidesuuu/raic.tech/main/dist/vencordjp/assets/raibadge.json", init)
        .then(r => r.json());
}

export default definePlugin({
    name: "BadgeAPI",
    description: "ユーザーにバッジを追加するAPI。",
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun],
    required: true,
    patches: [
        /* ユーザープロフィールのバッジリストコンポーネントをパッチ */
        {
            find: 'id:"premium",',
            replacement: [
                {
                    match: /&&(\i)\.push\(\{id:"premium".+?\}\);/,
                    replace: "$&$1.unshift(...$self.getBadges(arguments[0]));",
                },
                {
                    // alt: "", aria-hidden: false, src: originalSrc
                    match: /alt:" ","aria-hidden":!0,src:(?=(\i)\.src)/,
                    // ...badge.props, ..., src: badge.image ?? ...
                    replace: "...$1.props,$& $1.image??"
                },
                // replace their component with ours if applicable
                {
                    match: /(?<=text:(\i)\.description,spacing:12,.{0,50})children:/,
                    replace: "children:$1.component ? () => $self.renderBadgeComponent($1) :"
                },
                // conditionally override their onClick with badge.onClick if it exists
                {
                    match: /href:(\i)\.link/,
                    replace: "...($1.onClick && { onClick: vcE => $1.onClick(vcE, $1) }),$&"
                }
            ]
        },

        /* new profiles */
        {
            find: ".PANEL]:14",
            replacement: {
                match: /(?<=(\i)=\(0,\i\.\i\)\(\i\);)return 0===\i.length\?/,
                replace: "$1.unshift(...$self.getBadges(arguments[0].displayProfile));$&"
            }
        },
        {
            find: ".description,delay:",
            replacement: [
                {
                    // alt: "", aria-hidden: false, src: originalSrc
                    match: /alt:" ","aria-hidden":!0,src:(?=.{0,20}(\i)\.icon)/,
                    // ...badge.props, ..., src: badge.image ?? ...
                    replace: "...$1.props,$& $1.image??"
                },
                {
                    match: /(?<=text:(\i)\.description,.{0,50})children:/,
                    replace: "children:$1.component ? $self.renderBadgeComponent({ ...$1 }) :"
                },
                // conditionally override their onClick with badge.onClick if it exists
                {
                    match: /href:(\i)\.link/,
                    replace: "...($1.onClick && { onClick: vcE => $1.onClick(vcE, $1) }),$&"
                }
            ]
        }
    ],

    toolboxActions: {
        async "バッジを再取得"() {
            await loadBadges(true);
            Toasts.show({
                id: Toasts.genId(),
                message: "バッジを正常に再取得しました！",
                type: Toasts.Type.SUCCESS
            });
        }
    },

    async start() {
        Vencord.Api.Badges.addBadge(ContributorBadge);
        await loadBadges();
    },

    getBadges(props: { userId: string; user?: User; guildId: string; }) {
        if (!props) return [];

        try {
            props.userId ??= props.user?.id!;

            return _getBadges(props);
        } catch (e) {
            new Logger("BadgeAPI#hasBadges").error(e);
            return [];
        }
    },

    renderBadgeComponent: ErrorBoundary.wrap((badge: ProfileBadge & BadgeUserArgs) => {
        const Component = badge.component!;
        return <Component {...badge} />;
    }, { noop: true }),

    getRaiBadges(userId: string) {
        return RaiBadges[userId]?.map(badge => ({
            image: badge.badge,
            description: badge.tooltip,
            position: BadgePosition.START,
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)" // 画像がデフォルトのバッジに比べて少し大きすぎます
                }
            }
        }));
    },


    getDonorBadges(userId: string) {
        return DonorBadges[userId]?.map(badge => ({
            image: badge.badge,
            description: badge.tooltip,
            position: BadgePosition.START,
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)" // 画像がデフォルトのバッジに比べて少し大きすぎます
                }
            },
            onClick() {
                const modalKey = openModal(props => (
                    <ErrorBoundary noop onError={() => {
                        closeModal(modalKey);
                        VencordNative.native.openExternal("https://github.com/sponsors/Vendicated");
                    }}>
                        <Modals.ModalRoot {...props}>
                            <Modals.ModalHeader>
                                <Flex style={{ width: "100%", justifyContent: "center" }}>
                                    <Forms.FormTitle
                                        tag="h2"
                                        style={{
                                            width: "100%",
                                            textAlign: "center",
                                            margin: 0
                                        }}
                                    >
                                        <Heart />
                                        Vencordの寄付者
                                    </Forms.FormTitle>
                                </Flex>
                            </Modals.ModalHeader>
                            <Modals.ModalContent>
                                <Flex>
                                    <img
                                        role="presentation"
                                        src="https://cdn.discordapp.com/emojis/1026533070955872337.png"
                                        alt=""
                                        style={{ margin: "auto" }}
                                    />
                                    <img
                                        role="presentation"
                                        src="https://cdn.discordapp.com/emojis/1026533090627174460.png"
                                        alt=""
                                        style={{ margin: "auto" }}
                                    />
                                </Flex>
                                <div style={{ padding: "1em" }}>
                                    <Forms.FormText>
                                        このバッジはVencordの寄付者の特別な特典です
                                    </Forms.FormText>
                                    <Forms.FormText className={Margins.top20}>
                                        Vencordの開発を支援するために寄付者になることを検討してください。それには意味があります！
                                    </Forms.FormText>
                                </div>
                            </Modals.ModalContent>
                            <Modals.ModalFooter>
                                <Flex style={{ width: "100%", justifyContent: "center" }}>
                                    <DonateButton />
                                </Flex>
                            </Modals.ModalFooter>
                        </Modals.ModalRoot>
                    </ErrorBoundary>
                ));
            },
        }));
    }
});
