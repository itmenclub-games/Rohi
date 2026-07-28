export interface BotContext {
  from?: any;
  session: {
    step: string;
    data: Record<string, any>;
  };
}
