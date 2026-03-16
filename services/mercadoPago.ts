import { getAppSettings } from './storage';

const API_URL = 'https://api.mercadopago.com/v1';

export interface PixPaymentResponse {
  id: string;
  status: string;
  status_detail: string;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
}

export const createPixPayment = async (
  amount: number, 
  description: string, 
  email: string
): Promise<PixPaymentResponse | null> => {
  // Fix: Await getAppSettings as it returns a Promise
  const settings = await getAppSettings('MASTER');
  const token = settings.mercadoPagoAccessToken;

  if (!token) {
    throw new Error("Token de acesso do Mercado Pago não configurado pelo Administrador.");
  }

  const paymentData = {
    transaction_amount: Number(amount.toFixed(2)),
    description: description,
    payment_method_id: "pix",
    payer: {
      email: email,
      first_name: "Cliente",
      last_name: "Sistema"
    },
    installments: 1
  };

  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Idempotency-Key': `p4zz-${Date.now()}`
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erro MP:", errorData);
      throw new Error(errorData.message || "Erro ao criar pagamento PIX");
    }

    const data = await response.json();
    
    return {
      id: data.id.toString(),
      status: data.status,
      status_detail: data.status_detail,
      qr_code: data.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: data.point_of_interaction.transaction_data.ticket_url
    };

  } catch (error) {
    console.error("Erro no serviço de pagamento:", error);
    throw error;
  }
};

export const checkPaymentStatus = async (paymentId: string): Promise<string> => {
  // Fix: Await getAppSettings as it returns a Promise
  const settings = await getAppSettings('MASTER');
  const token = settings.mercadoPagoAccessToken;

  if (!token) return 'pending';

  try {
    const response = await fetch(`${API_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return data.status; // approved, pending, rejected, etc.
    }
    return 'pending';
  } catch (error) {
    return 'pending';
  }
};