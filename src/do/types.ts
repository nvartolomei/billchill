export type Bill = {
  name: string;
  date: string;
  scan: {
    items: {
      id: string;
      name: string;
      amount: number;
      autoClaiming: boolean;
      claimers: {
        id: string;
        shares: number;
      }[];
    }[];
    total: number;
  };
  participants: Record<string, { id: string; name: string }>;
};
