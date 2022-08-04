import { Router } from "express";
import { body } from "express-validator";
import controller from "./controller";
import validators from "./validators";

const createRouter = () => {
  const router: Router = Router();
  router.post(
    "/access",
    body().isArray(),
    body("*.action").isIn(["ADD", "REMOVE"]),
    validators.bodyDiscordId("*.platformUserId"),
    validators.bodyDiscordId("*.platformGuildId"),
    validators.bodyStringValidator("*.guildName"),
    body("*.platformGuildData"),
    validators.bodyArrayValidator("*.roles"),
    validators.bodyStringValidator("*.roles.*.roleName"),
    // validators.bodyDiscordId("*.roles.*.platformRoleId"),
    controller.access
  );

  router.post(
    "/guild",
    body("action").isIn(["CREATE", "UPDATE", "DELETE"]),
    validators.bodyDiscordId("platformGuildId"),
    body("platformGuildData").optional(),
    controller.guild
  );

  router.post(
    "/role",
    body("action").isIn(["CREATE", "UPDATE", "DELETE"]),
    validators.bodyDiscordId("platformGuildId"),
    body("platformGuildData").optional(),
    validators.bodyDiscordId("platformRoleId").optional(),
    body("platformRoleData").optional(),
    controller.role
  );

  router.get(
    "/info/:platformGuildId",
    validators.paramDiscordId("platformGuildId"),
    controller.info
  );

  router.post(
    "/resolveUser",
    validators.bodyStringValidator("access_token"),
    controller.resolveUser
  );

  router.get(
    "/listGateables/:platformUserId",
    validators.paramDiscordId("platformUserId"),
    controller.listGateables
  );

  router.post(
    "/manageMigratedActions",
    validators.bodyDiscordId("guildId"),
    validators.bodyDiscordId("roleId"),
    validators.messageValidator,
    controller.manageMigratedActions
  );

  router.post(
    "/isMember",
    validators.bodyDiscordId("serverId"),
    validators.bodyDiscordId("platformUserId"),
    controller.isMember
  );

  // called before guild creation in fronend, to get info of the server
  router.post(
    "/server/:guildId",
    validators.paramDiscordId("guildId"),
    controller.server
  );

  // called from BE, to send the join/claim button to the inviteChannel
  router.post(
    "/channels/sendDiscordButton",
    validators.bodyDiscordId("guildId"),
    validators.bodyDiscordId("channelId"),
    ...validators.buttonMetaData,
    controller.sendDiscordButton
  );

  router.post(
    "/channels/create",
    validators.bodyDiscordId("guildId"),
    validators.channelNameValidator,
    controller.createChannel
  );

  router.get(
    "/user/:platformUserId",
    validators.paramDiscordId("platformUserId"),
    controller.getUser
  );

  router.get(
    "/members/:serverId/:roleId",
    validators.paramDiscordId("roleId"),
    validators.paramDiscordId("serverId"),
    controller.getMembersByRole
  );

  router.post(
    "/poll",
    [
      validators.bodyNumberIdValidator("id"),
      validators.bodyIdValidator("platformGuildId"),
      validators.bodyStringValidator("question"),
      validators.bodyIdValidator("expDate"),
      validators.bodyArrayValidator("options"),
    ],
    controller.createPoll
  );

  router.get(
    "/emotes/:guildId",
    validators.paramDiscordId("guildId"),
    controller.getEmotes
  );

  router.get(
    "/channels/:guildId",
    validators.paramDiscordId("guildId"),
    controller.getChannels
  );

  return router;
};

export default createRouter;
