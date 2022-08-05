type AccessEventParams = {
  action: "ADD" | "REMOVE";
  platformUserId: string;
  platformGuildId: string;
  guildName: string;
  platformGuildData: { inviteChannel: string };
  roles: {
    roleName: string;
    platformRoleId: string;
    platformRoleData?: {
      isGuarded?: boolean;
    };
  }[];
};

type GuildEventParams = {
  action: "CREATE" | "UPDATE" | "DELETE";
  guildName: string;
  platformGuildId: string;
  platformGuildData?: { inviteChannel?: string };
};

type GuildEventResponse =
  | {
      platformGuildId: string;
      platformGuildData: { inviteChannel: string; joinButton?: boolean };
    }
  | { success: boolean };

type RoleEventParams = {
  action: "CREATE" | "UPDATE" | "DELETE";
  roleName: string;
  platformGuildId: string;
  platformGuildData: { inviteChannel: string };
  platformRoleId?: string;
  platformRoleData?: {
    isGuarded?: boolean;
    gatedChannels?: string[];
    grantAccessToExistingUsers: boolean;
  };
};

type RoleEventResponse =
  | {
      platformGuildData: { inviteChannel: string };
      platformRoleId: string;
    }
  | { success: boolean };

type CreateChannelParams = {
  guildId: string;
  channelName: string;
};

type DeleteChannelAndRoleParams = {
  guildId: string;
  roleId: string;
  channelId: string;
};

type UserResult = {
  username: string;
  discriminator: string;
  avatar: string;
  roles: string[];
};

type ErrorResult = {
  errors: { msg: string; value: string[] }[];
};

class ActionError extends Error {
  ids: string[];

  constructor(message: string, ids: string[]) {
    super(message);
    this.ids = ids;
  }
}

type CreateRoleResult = {
  id: string;
};

type DiscordChannel = {
  id: string;
  name: string;
};

type SelectMenuOption = {
  label: string;
  description: string;
  value: string;
};

type NewPoll = {
  roles: SelectMenuOption[];
  requirements: SelectMenuOption[];
  requirementId: number;
  platformGuildId: string;
  channelId: string;
  question: string;
  description: string;
  options: string[];
  reactions: string[];
  expDate: string;
};

type Poll = {
  id: number;
  requirementId: number;
  platformGuildId: string;
  question: string;
  description: string;
  options: string[];
  reactions: string[];
  startDate: number;
  expDate: number;
};

type Reaction = {
  name: string;
  users: string[];
};

type Vote = {
  platform: "DISCORD" | "TELEGRAM";
  pollId: number;
  platformUserId: string;
  optionIndex: number;
};
type ButtonMetaData = Partial<{
  title: string;
  description: string;
  button: string;
  isJoinButton: boolean;
}>;

type Platform = {
  id: number;
  isGuarded: boolean;
  platformId: string;
  type: string;
  platformName: string;
};

type Role = {
  id: number;
  name: string;
  platforms: {
    roleId: number;
    platformId: number;
    inviteChannel: string;
    discordRoleId: string;
  }[];
};

type GuildOfServer = {
  id: number;
  name: string;
  urlName: string;
  description: string;
  imageUrl: string;
  platforms: Platform[];
  roles: Role[];
  poaps: any[];
};

type Emote = {
  name: string;
  id: string;
  image: string;
  animated: boolean;
};

type ChannelObj = {
  name: string;
  id: string;
};

type ResolveUserResopnse = {
  platformUserId: string;
  platformUserData: {
    access_token: string;
  };
};

export {
  ButtonMetaData,
  CreateChannelParams,
  DeleteChannelAndRoleParams,
  UserResult,
  ErrorResult,
  ActionError,
  CreateRoleResult,
  DiscordChannel,
  SelectMenuOption,
  NewPoll,
  Poll,
  Reaction,
  Vote,
  GuildOfServer,
  Emote,
  ChannelObj,
  AccessEventParams,
  GuildEventParams,
  GuildEventResponse,
  RoleEventParams,
  RoleEventResponse,
  ResolveUserResopnse,
};
