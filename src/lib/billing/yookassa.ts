// Direct REST client for ЮKassa. Plain fetch, not the npm SDK — same
// reasoning as voyageai: a thin custom client is easier to debug, types
// are tighter, and we don't carry a dep that might break on package
// updates.
//
// API docs: https://yookassa.ru/developers/api
// Auth: HTTP Basic shopId:secretKey
// Idempotence: every state-changing call must carry a unique
// Idempotence-Key header — we generate it once per Payment row.

import { reportError } from "@/lib/telemetry";

const API_BASE = "https://api.yookassa.ru/v3";

export interface YookassaPaymentAmount {
  /** Decimal string with two fractional digits, e.g. "3990.00". */
  value: string;
  currency: "RUB";
}

export interface YookassaConfirmation {
  type: "redirect";
  return_url: string;
  /** Set when status === "pending" — URL to send the user to. */
  confirmation_url?: string;
}

export type YookassaPaymentStatus =
  | "pending"
  | "waiting_for_capture"
  | "succeeded"
  | "canceled";

export interface YookassaPayment {
  id: string;
  status: YookassaPaymentStatus;
  amount: YookassaPaymentAmount;
  description?: string;
  metadata?: Record<string, string>;
  paid: boolean;
  refundable: boolean;
  created_at: string;
  captured_at?: string;
  confirmation?: YookassaConfirmation;
  payment_method?: {
    id?: string;
    type?: string;
    saved?: boolean;
  };
  cancellation_details?: {
    party?: string;
    reason?: string;
  };
  test?: boolean;
}

export interface CreatePaymentArgs {
  amountKopecks: number;
  /** Plain Russian description for the receipt and ЮKassa dashboard. */
  description: string;
  /** URL the user is redirected back to after they finish on the
   *  ЮKassa hosted page (success OR failure — UI inspects status). */
  returnUrl: string;
  /** Free-form key/value bag echoed back in webhooks. We store orgId
   *  and our internal Payment.id here for cross-referencing. */
  metadata: Record<string, string>;
  /** Idempotence key — same retry of the same intent must use the
   *  same key, distinct intents must differ. */
  idempotenceKey: string;
  /** When true, ЮKassa saves the payment method for future server-
   *  initiated charges (auto-renewal). User must consent. */
  savePaymentMethod?: boolean;
  /** 54-ФЗ receipt block. Required when shop accepts 54-ФЗ payments. */
  receipt?: {
    customer: { email: string };
    items: Array<{
      description: string;
      quantity: string;
      amount: { value: string; currency: "RUB" };
      vat_code: 1 | 2 | 3 | 4 | 5 | 6;
      payment_mode: "full_payment";
      payment_subject: "service";
    }>;
  };
}

export interface YookassaCredentials {
  shopId: string;
  secretKey: string;
}

function authHeader(creds: YookassaCredentials): string {
  const raw = `${creds.shopId}:${creds.secretKey}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/** Convert integer kopecks → "12345.67" decimal string ЮKassa expects. */
export function kopecksToYookassaValue(kopecks: number): string {
  if (!Number.isInteger(kopecks) || kopecks < 0) {
    throw new Error(`Invalid kopecks amount: ${kopecks}`);
  }
  const rubles = Math.floor(kopecks / 100);
  const fractional = kopecks % 100;
  return `${rubles}.${fractional.toString().padStart(2, "0")}`;
}

export class YookassaClient {
  constructor(private readonly creds: YookassaCredentials) {}

  static fromEnv(): YookassaClient | null {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    if (!shopId || !secretKey) return null;
    return new YookassaClient({ shopId, secretKey });
  }

  async createPayment(args: CreatePaymentArgs): Promise<YookassaPayment> {
    const body = {
      amount: {
        value: kopecksToYookassaValue(args.amountKopecks),
        currency: "RUB" as const,
      },
      capture: true,
      confirmation: {
        type: "redirect" as const,
        return_url: args.returnUrl,
      },
      description: args.description,
      metadata: args.metadata,
      save_payment_method: args.savePaymentMethod ?? false,
      receipt: args.receipt,
    };

    const response = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: authHeader(this.creds),
        "Content-Type": "application/json",
        "Idempotence-Key": args.idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const err = new Error(
        `ЮKassa createPayment ${response.status}: ${text.slice(0, 500)}`
      );
      await reportError(err, {
        op: "billing.yookassa.create",
        tags: { status: response.status },
      });
      throw err;
    }

    return (await response.json()) as YookassaPayment;
  }

  /** Refetch a payment to confirm status after a webhook (best practice). */
  async getPayment(id: string): Promise<YookassaPayment> {
    const response = await fetch(`${API_BASE}/payments/${id}`, {
      method: "GET",
      headers: { Authorization: authHeader(this.creds) },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const err = new Error(
        `ЮKassa getPayment ${response.status}: ${text.slice(0, 500)}`
      );
      await reportError(err, {
        op: "billing.yookassa.get",
        tags: { status: response.status, paymentId: id },
      });
      throw err;
    }
    return (await response.json()) as YookassaPayment;
  }
}
