/* eslint-disable class-methods-use-this */
/* eslint no-return-await: "off" */

import {
  Collection,
  GuildMember,
  Invite,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  MessageReaction,
  PartialGuildMember,
  PartialMessageReaction,
  PartialUser,
  RateLimitData,
  Role,
  User,
} from "discord.js";
import { Discord, Guard, On } from "discordx";
import dayjs from "dayjs";
import axios from "axios";
import IsDM from "../guards/IsDM";
import NotABot from "../guards/NotABot";
import Main from "../Main";
import logger from "../utils/logger";
import pollStorage from "../api/pollStorage";
import config from "../config";
import { Vote } from "../api/types";
import NotDM from "../guards/NotDM";
import { createPollText } from "../api/polls";
import redisClient from "../database";

const messageReactionCommon = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  removed: boolean
) => {
  if (!user.bot) {
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        logger.error("Something went wrong when fetching the message:", error);

        return;
      }
    }

    const msg = reaction.message;

    const result = msg.embeds[0]?.title
      ?.match(/Poll #(.*?): /g)
      ?.map((str: string) => str?.substring(6, str.length - 2));

    if (result?.length === 1) {
      try {
        const pollId = +result[0];

        const pollResponse = await axios.get(
          `${config.backendUrl}/poll/${pollId}`
        );

        const poll = pollResponse.data;

        const { reactions, expDate } = poll;

        if (dayjs().isBefore(dayjs.unix(expDate))) {
          const { emoji } = reaction;
          const emojiName = emoji.id
            ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
            : emoji.name;

          if (!removed) {
            let userReactions: Collection<string, MessageReaction>;

            if (reactions.includes(emojiName)) {
              const optionIndex = reactions.indexOf(emojiName);

              await axios.post(`${config.backendUrl}/poll/vote`, {
                platform: config.platform,
                pollId,
                platformUserId: user.id,
                optionIndex,
              } as Vote);

              userReactions = msg.reactions.cache.filter(
                (react) =>
                  react.users.cache.has(user.id) && react.emoji !== emoji
              );
            } else {
              userReactions = msg.reactions.cache.filter(
                (react) =>
                  react.users.cache.has(user.id) && react.emoji === emoji
              );
            }

            try {
              Array.from(userReactions.values()).map(
                async (react) =>
                  await msg.reactions.resolve(react).users.remove(user.id)
              );
            } catch (error) {
              logger.error("Failed to remove reaction:", error);
            }
          } else if (reactions.includes(emojiName)) {
            const optionIndex = reactions.indexOf(emojiName);

            await axios.delete(`${config.backendUrl}/poll/vote`, {
              data: {
                platform: config.platform,
                pollId,
                platformUserId: user.id,
                optionIndex,
              } as Vote,
            });
          }

          const results = await axios.get(
            `${config.backendUrl}/poll/results/${pollId}`
          );

          msg.embeds[0].description = await createPollText(
            { platformGuildId: reaction.message.guildId, ...poll },
            results
          );

          msg.edit({ embeds: [msg.embeds[0]] });
        } else {
          logger.warn(`Poll #${pollId} has already expired.`);
        }
      } catch (e) {
        logger.error(e);
      }
    }
  }
};

@Discord()
abstract class Events {
  @On("ready")
  onReady(): void {
    logger.info("Bot logged in.");
  }

  @On("rateLimit")
  onRateLimit(rateLimited: RateLimitData): void {
    logger.warn(`BOT Rate Limited. ${JSON.stringify(rateLimited)}`);
  }

  @On("messageCreate")
  @Guard(NotABot, NotDM)
  async onPublicMessage([message]: [Message]): Promise<void> {
    if (
      message.content.toLowerCase().match(/^(#|!|\/)((join)(-guild|)|verify)$/)
    ) {
      logger.verbose(
        `/join command was used by ${message.author.username}#${message.author.discriminator}`
      );

      const guildRes = await axios.get(
        `${config.backendUrl}/guild/platform/${config.platform}/${message.guildId}`
      );

      if (!guildRes) {
        return;
      }

      const joinButton = new MessageButton({
        customId: "join-button",
        label: `Join ${guildRes.data?.name || "Guild"}`,
        emoji: "🔗",
        style: "PRIMARY",
      });

      const guideButton = new MessageButton({
        label: "Guide",
        url: "https://docs.guild.xyz/",
        style: "LINK",
      });

      const row = new MessageActionRow({
        components: [joinButton, guideButton],
      });

      await message.reply({
        content: "Click the button below to get your join link.",
        components: [row],
      });
    }
  }

  @On("messageCreate")
  @Guard(NotABot, IsDM)
  async onPrivateMessage([message]: [Message]): Promise<void> {
    const userId = message.author.id;
    const msgText = message.content;
    const poll = pollStorage.getPoll(userId);

    if (poll) {
      const { question, options, reactions } = poll;

      switch (pollStorage.getUserStep(userId)) {
        case 1: {
          pollStorage.savePollQuestion(userId, msgText);
          pollStorage.setUserStep(userId, 2);

          await message.channel.send(
            "Please give me the description of your poll or skip to the next step by sending `skip`."
          );

          break;
        }

        case 2: {
          pollStorage.savePollDescription(
            userId,
            msgText === "skip" ? undefined : msgText
          );
          pollStorage.setUserStep(userId, 3);

          await message.channel.send(
            "Please give me the first option of your poll."
          );

          break;
        }

        case 3: {
          if (options.length === reactions.length) {
            if (options.length === 20) {
              await message.reply(
                "You have reached the maximum number of options."
              );

              break;
            }

            if (!options.includes(msgText)) {
              pollStorage.savePollOption(userId, msgText);

              await message.reply("Now send me the corresponding emoji");
            } else {
              await message.reply("This option has already been added");
            }
          } else if (!reactions.includes(msgText)) {
            const emojiRegex =
              /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
            const emoteRegex = /<a*:\w+:[0-9]+>/;

            if (msgText.match(emojiRegex) || msgText.match(emoteRegex)) {
              if (msgText.match(emoteRegex)) {
                const emotes = Main.client.emojis.cache.map((emoji) => ({
                  name: emoji.name,
                  id: emoji.id,
                }));

                const emoteExtractor = /^<(a*)\S*:(\w+)\S*:([0-9]+)\S*>$/i;
                const [, , name, id] = emoteExtractor.exec(msgText);

                if (!emotes.some((e) => e.name === name && e.id === id)) {
                  await message.reply(
                    "Please only use emotes from your guild. Send a differend emote."
                  );

                  return;
                }
              }

              pollStorage.savePollReaction(userId, msgText);

              if (options.length === 1) {
                await message.reply("Please give me the second option.");
              } else {
                await message.reply(
                  "Please give me a new option or go to the next step by using **/enough**."
                );
              }
            } else {
              await message.reply(
                "The message you sent doesn't contain any emoji"
              );
            }
          } else {
            await message.reply(
              "This emoji has already been used, please choose another one."
            );
          }

          break;
        }

        case 4: {
          try {
            const dateRegex =
              /([1-9][0-9]*|[0-9]):([0-1][0-9]|[0-9]|[2][0-4]):([0-5][0-9]|[0-9])/;
            const found = dateRegex.exec(msgText);

            if (!found) {
              await message.reply(
                "The message you sent me is not in the DD:HH:mm format. Please verify the contents of your message and send again."
              );

              return;
            }

            const [, day, hour, minute] = found;

            const expDate = dayjs()
              .add(parseInt(day, 10), "day")
              .add(parseInt(hour, 10), "hour")
              .add(parseInt(minute, 10), "minute")
              .unix()
              .toString();

            poll.expDate = expDate;

            pollStorage.savePollExpDate(userId, expDate);
            pollStorage.setUserStep(userId, 4);

            await message.reply("Your poll will look like this:");

            const embed = new MessageEmbed({
              title: `Poll #69: ${question}`,
              color: `#${config.embedColor}`,
              description: await createPollText(poll),
            });

            const msg = await message.channel.send({ embeds: [embed] });

            reactions.map(async (emoji) => await msg.react(emoji));

            await message.reply(
              "You can accept it by using **/done**,\n" +
                "reset the data by using **/reset**\n" +
                "or cancel it using **/cancel**."
            );
          } catch (e) {
            message.reply("Incorrect input, please try again.");
          }

          break;
        }

        default: {
          break;
        }
      }
    } else {
      const embed = new MessageEmbed({
        title: "I'm sorry, but I couldn't interpret your request.",
        color: `#ff0000`,
        description:
          "You can find more information on [docs.guild.xyz](https://docs.guild.xyz/).",
      });

      await message.channel.send({ embeds: [embed] }).catch(logger.error);

      logger.verbose(
        `unkown request: ${message.author.username}#${message.author.discriminator}: ${message.content}`
      );
    }
  }

  @On("guildMemberAdd")
  onGuildMemberAdd([member]: [GuildMember | PartialGuildMember]): void {
    Main.platform.user.join(member.guild.id, member.user.id).catch(() => {});
  }

  @On("inviteDelete")
  onInviteDelete([invite]: [Invite]): void {
    Main.client.guilds.fetch(invite.guild.id).then((guild) => {
      logger.verbose(`onInviteDelete guild: ${guild.name}`);

      redisClient.client.del(`info:${guild.id}`);
    });
  }

  @On("messageReactionAdd")
  onMessageReactionAdd([reaction, user]: [
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ]): void {
    messageReactionCommon(reaction, user, false);
  }

  @On("messageReactionRemove")
  onMessageReactionRemove([reaction, user]: [
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ]): void {
    messageReactionCommon(reaction, user, true);
  }

  @On("roleCreate")
  async onRoleCreate([role]: [Role]): Promise<void> {
    const guildOfServer = await Main.platform.guild.get(role.guild.id);
    if (
      guildOfServer?.guildPlatforms.find(
        (gp) => gp.platformGuildId === role.guild.id
      )?.platformGuildData?.isGuarded
    ) {
      await role.edit({ permissions: role.permissions.remove("VIEW_CHANNEL") });
    }
  }
}

export default Events;
