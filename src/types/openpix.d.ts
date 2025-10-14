type OpenPixPluginEventType =
  | 'CHARGE_COMPLETED'
  | 'CHARGE_EXPIRED'
  | 'ON_CLOSE'
  | 'ON_ERROR';

interface OpenPixPluginEvent {
  type: OpenPixPluginEventType;
  charge?: {
    correlationID?: string;
    status?: string;
  };
  error?: unknown;
}

type OpenPixCommand =
  | ['config', { appID: string }]
  | [
      'pix',
      {
        value: number;
        correlationID: string;
        description?: string;
        expiresIn?: number;
        customer?: {
          name?: string;
          email?: string;
          taxID?: string;
          phone?: string;
        };
        additionalInfo?: Array<{ key: string; value: string }>;
      }
    ];

type OpenPixQueue = OpenPixCommand[] & {
  addEventListener?: (handler: (event: OpenPixPluginEvent) => void) => () => void;
};

declare global {
  interface Window {
    $openpix?: OpenPixQueue;
  }
}

export {};
