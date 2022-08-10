import { Channel, ChannelCredentials, ChannelOptions } from '@grpc/grpc-js';
export declare function createChannel(address: string, credentials?: ChannelCredentials, options?: ChannelOptions): Channel;
export declare function waitForChannelReady(channel: Channel, deadline: Date): Promise<void>;
