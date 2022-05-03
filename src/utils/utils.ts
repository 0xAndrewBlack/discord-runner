/* eslint-disable default-param-last */
import { AxiosResponse } from "axios";
import {
  GuildMember,
  DiscordAPIError,
  MessageButton,
  MessageActionRow,
  MessageEmbed,
  Guild,
  Collection,
  GuildChannel,
  Permissions,
  MessageOptions,
  Role,
} from "discord.js";
import { ActionError, ErrorResult, UserResult } from "../api/types";
import config from "../config";
import Main from "../Main";
import { getGuildsOfServer } from "../service";
import logger from "./logger";

const getUserResult = (member: GuildMember): UserResult => ({
  username: member.user.username,
  discriminator: member.user.discriminator,
  avatar: member.user.avatar,
  roles: member.roles.cache
    .filter((role) => role.id !== member.guild.roles.everyone.id)
    .map((role) => role.id),
});

const getErrorResult = (error: Error): ErrorResult => {
  let errorMsg: string;
  let ids: string[];
  if (error instanceof DiscordAPIError) {
    if (error.code === 50001) {
      // Missing access
      errorMsg = "guild not found";
    } else if (error.code === 10013) {
      // Unknown User
      errorMsg = "cannot fetch member";
    } else if (error.code === 10007) {
      // Unknown Member
      errorMsg = "user is not member";
    } else {
      errorMsg = `discord api error: ${error.message}`;
    }
  } else if (error instanceof ActionError) {
    errorMsg = error.message;
    ids = error.ids;
  } else {
    logger.error(error);
    errorMsg = error.message;
  }
  return {
    errors: [
      {
        msg: errorMsg,
        value: ids,
      },
    ],
  };
};

const logBackendError = (error) => {
  const errorData = error.response?.data;
  const errors = errorData?.errors;

  if (errors?.length > 0 && errors[0]?.msg) {
    logger.verbose(errors[0].msg);
  } else if (error.response?.data) {
    logger.verbose(JSON.stringify(errorData));
  } else {
    logger.verbose(JSON.stringify(error));
  }
};

const logAxiosResponse = (res: AxiosResponse<any>) => {
  logger.verbose(
    `${res.status} ${res.statusText} data:${JSON.stringify(res.data)}`
  );
  return res;
};

const isNumber = (value: any) =>
  typeof value === "number" && Number.isFinite(value);

const createJoinInteractionPayload = (
  guild: {
    name: string;
    urlName: string;
    description: string;
    themeColor: string;
    imageUrl: string;
  },
  title: string = "Verify your wallet",
  messageText: string = null,
  buttonText?: string
) => {
  const joinButton = new MessageButton({
    customId: "join-button",
    label: buttonText || `Join ${guild?.name || "Guild"}`,
    emoji: "🔗",
    style: "PRIMARY",
  });
  const guideButton = new MessageButton({
    label: "Guide",
    url: "https://docs.guild.xyz/",
    style: "LINK",
  });
  const row = new MessageActionRow({ components: [joinButton, guideButton] });
  return {
    embeds: [
      new MessageEmbed({
        title,
        url: guild ? `${config.guildUrl}/${guild?.urlName}` : null,
        description:
          messageText ||
          guild?.description ||
          "Join this guild and get your role(s)!",
        color: `#${config.embedColor}`,
        author: {
          name: guild?.name || "Guild",
          iconURL: encodeURI(
            guild?.imageUrl?.startsWith("https")
              ? guild?.imageUrl
              : "https://cdn.discordapp.com/attachments/950682012866465833/951448319169802250/kerek.png"
          ),
        },
        thumbnail: {
          url: "https://cdn.discordapp.com/attachments/950682012866465833/951448318976884826/dc-message.png",
        },
        footer: {
          text: "Do not share your private keys. We will never ask for your seed phrase.",
        },
      }),
    ],
    components: [row],
  };
};

const getAccessedChannelsByRoles = (guild: Guild, accessedRoles: string[]) =>
  guild.channels.cache.filter(
    (channel) =>
      channel.type !== "GUILD_CATEGORY" &&
      !channel.isThread() &&
      channel.permissionOverwrites.cache.some(
        (po) =>
          accessedRoles.some((ar) => ar === po.id) &&
          po.allow.has(Permissions.FLAGS.VIEW_CHANNEL)
      )
  ) as Collection<string, GuildChannel>;

const getChannelsByCategoryWithRoles = (guild: Guild) => {
  // sort channels by categoryId
  const channelsByCategoryId = guild.channels.cache.reduce<
    Map<string, { id: string; name: string; roles: string[] }[]>
  >((acc, ch) => {
    // skip if not text or news channel
    if (ch.type !== "GUILD_TEXT" && ch.type !== "GUILD_NEWS") {
      return acc;
    }

    // handle where threre is not parent
    const parentId = ch.parent?.id || "-";

    // create parentId key if not exists
    if (!acc.has(parentId)) {
      acc.set(parentId, []);
    }

    // filter for roles that have explicit permission overwrites
    const roles = guild.roles.cache
      .filter((role) =>
        ch.permissionOverwrites.cache
          .get(role.id)
          ?.allow.has(Permissions.FLAGS.VIEW_CHANNEL)
      )
      .map((role) => role.id);

    // add channel info to the category's array
    acc.get(parentId).push({
      id: ch.id,
      name: ch.name,
      roles,
    });
    return acc;
  }, new Map());

  // add categoryName and convert to array
  const channelsByCategory = [];
  channelsByCategoryId.forEach((v, k) => {
    channelsByCategory.push({
      id: k,
      name: k === "-" ? "-" : guild.channels.cache.get(k).name,
      channels: v,
    });
  });

  return channelsByCategory;
};

const getCategoriesWithChannels = (guild, roleIds) => {
  const categories = {};
  const accessedChannelsByRoles = getAccessedChannelsByRoles(guild, roleIds);

  accessedChannelsByRoles.forEach((channel) => {
    if (categories[channel.parentId]) {
      categories[channel.parentId].push(channel);
    } else {
      categories[channel.parentId] = [];
      categories[channel.parentId].push(channel);
    }
  });

  return categories;
};

const getCategoryNameById = (guild, categoryId) => {
  const channelsByCategoryWithRoles = getChannelsByCategoryWithRoles(guild);
  const category = channelsByCategoryWithRoles.find((c) => c.id === categoryId);
  return category.name;
};

const getCategoryFieldValues = (guild, roleIds) => {
  const fields = [];

  const categoryEmoji = Main.Client.emojis.cache.get("893836008712441858");
  const privateChannelEmoji =
    Main.Client.emojis.cache.get("893836025699377192");

  const categories = getCategoriesWithChannels(guild, roleIds);

  Object.keys(categories).forEach((categoryId) => {
    fields.push({
      name: `${categoryEmoji || "▶️"} ${getCategoryNameById(
        guild,
        categoryId
      )}`,
      value: `\n${categories[categoryId]
        .map(
          (c) =>
            `[${privateChannelEmoji || "#"}${
              c.name
            }](https://discord.com/channels/${guild.id}/${c.id})`
        )
        .join("\n")}`,
    });
  });

  return fields;
};

const getRoleNames = (guild, roleIds) =>
  guild.roles.cache
    .filter((role) => roleIds.some((roleId) => roleId === role.id))
    .map((role) => role.name);

const getNotAccessedRoleIds = (guildRoleIds, roleIds) =>
  guildRoleIds.filter((roleId) => !roleIds.includes(roleId));

const getGuildRoleIds = (guildsOfServer) =>
  guildsOfServer[0].roles
    .map((r) => r.platforms)
    .map((p) => p[0].discordRoleId);

const printRoleNames = (
  roleNames: string[],
  accessed: boolean,
  modifiedRoleName: string = ""
) => {
  if (roleNames.length === 0) return "";
  const emoji = accessed ? `✅` : `❌`;
  let result: string = "";
  let filteredRoleNames = roleNames;

  if (modifiedRoleName !== "") {
    result = `${
      accessed ? `✅ 🆕 ${modifiedRoleName}\n` : `❌ 🆕 ${modifiedRoleName}\n`
    }`;
    filteredRoleNames = roleNames.filter((rn) => rn !== modifiedRoleName);
  }

  if (filteredRoleNames.length > 0) {
    result += `${emoji} ${filteredRoleNames.join(`\n${emoji} `)}`;
  }

  return result;
};

const getLinkButton = (label, url) =>
  new MessageButton({
    label,
    style: "LINK",
    url,
    disabled: false,
    type: 2,
  });

const getJoinReplyMessage = async (
  roleIds: string[],
  guild: Guild,
  userId: string
): Promise<MessageOptions> => {
  let message: MessageOptions;
  logger.verbose(`getJoinReply - ${roleIds} ${guild.id} ${userId}`);

  const guildsOfServer = await getGuildsOfServer(guild.id);
  const guildRoleIds = getGuildRoleIds(guildsOfServer);

  if (roleIds && roleIds.length !== 0) {
    const accessedRoleNames = getRoleNames(guild, roleIds);
    const notAccessedRoleIds = getNotAccessedRoleIds(guildRoleIds, roleIds);
    const notAccessedRoleNames = getRoleNames(guild, notAccessedRoleIds);

    const fields = getCategoryFieldValues(guild, roleIds);

    const description = `You got ${roleIds.length} out of ${
      guildRoleIds.length
    } role${
      guildRoleIds.length > 1 ? "s" : ""
    } with your connected address(es):\n\n${printRoleNames(
      accessedRoleNames,
      true
    )}\n${printRoleNames(notAccessedRoleNames, false)}\n${
      notAccessedRoleNames.length > 0 ? "\n" : ""
    }...giving you access to the following channels:\n`;

    const embed = new MessageEmbed({
      title: `Successfully joined guild`,
      description,
      color: 0x0dff00,
      fields,
    });

    const button = getLinkButton(
      "View details / connect new address",
      `${config.guildUrl}/${guildsOfServer[0].urlName}/?discordId=${userId}`
    );

    message = {
      content: "We have updated your accesses successfully.",
      components: [new MessageActionRow({ components: [button] })],
      embeds: [embed],
    };
  } else if (roleIds && roleIds[0] !== "") {
    const notAccessedRoleIds = getNotAccessedRoleIds(guildRoleIds, roleIds);
    const notAccessedRoleNames = getRoleNames(guild, notAccessedRoleIds);
    const button = getLinkButton(
      "View details / connect new address",
      `${config.guildUrl}/${guildsOfServer[0].urlName}/?discordId=${userId}`
    );

    const embed = new MessageEmbed({
      title: `No access`,
      description: `You don't satisfy the requirements to any roles on this server with your connected address(es).\n\n${printRoleNames(
        notAccessedRoleNames,
        false
      )}`,
      color: 0xff0000,
    });

    message = {
      content: "We have updated your accesses successfully.",
      components: [new MessageActionRow({ components: [button] })],
      embeds: [embed],
    };
  } else {
    const button = getLinkButton(
      "Join",
      `${config.guildUrl}/${guildsOfServer[0].urlName}/?discordId=${userId}`
    );

    return {
      components: [new MessageActionRow({ components: [button] })],
      content: `This is **your** join link. Do **NOT** share it with anyone!`,
    };
  }

  return message;
};

const denyViewEntryChannelForRole = async (
  role: Role,
  entryChannelId: string
) => {
  try {
    const entryChannel = role.guild.channels.cache.get(
      entryChannelId
    ) as GuildChannel;
    if (
      !entryChannel.permissionOverwrites.cache
        .get(role.id)
        ?.deny.has(Permissions.FLAGS.VIEW_CHANNEL)
    ) {
      await entryChannel.permissionOverwrites.create(role.id, {
        VIEW_CHANNEL: false,
      });
    }
  } catch (error) {
    logger.warn(error);
    throw new Error(
      `Entry channel does not exists. (server: ${role.guild.id}, channel: ${entryChannelId})`
    );
  }
};

const updateAccessedChannelsOfRole = (
  serverId: string,
  roleId: string,
  channelIds: string[]
) => {
  const shouldHaveAccess = new Set(channelIds);

  const channels = Main.Client.guilds.cache
    .get(serverId)
    ?.channels.cache.filter((channel) => !channel.isThread()) as Collection<
    string,
    GuildChannel
  >;

  const [channelsToAllow, channelsToDeny] = channels.partition(
    (channel) =>
      shouldHaveAccess.has(channel.id) ||
      shouldHaveAccess.has(channel.parentId) ||
      (channel.type !== "GUILD_CATEGORY" &&
        !channel.parent &&
        shouldHaveAccess.has("-"))
  );

  return Promise.all([
    ...channelsToDeny.map((channelToDenyAccessTo) =>
      channelToDenyAccessTo.permissionOverwrites.create(roleId, {
        VIEW_CHANNEL: null,
      })
    ),
    ...channelsToAllow.map((channelToAllowAccessTo) =>
      channelToAllowAccessTo.permissionOverwrites.create(roleId, {
        VIEW_CHANNEL: true,
      })
    ),
    ...channelsToAllow.map((channelToAllowAccessTo) =>
      channelToAllowAccessTo.permissionOverwrites.create(
        Main.Client.guilds.cache.get(serverId).roles.everyone.id,
        {
          VIEW_CHANNEL: false,
        }
      )
    ),
  ]);
};

export {
  getUserResult,
  getErrorResult,
  logBackendError,
  logAxiosResponse,
  isNumber,
  createJoinInteractionPayload,
  getJoinReplyMessage,
  getAccessedChannelsByRoles,
  denyViewEntryChannelForRole,
  getChannelsByCategoryWithRoles,
  updateAccessedChannelsOfRole,
  getCategoriesWithChannels,
  getCategoryNameById,
  getCategoryFieldValues,
  getRoleNames,
  getNotAccessedRoleIds,
  getGuildRoleIds,
  printRoleNames,
  getLinkButton,
};
