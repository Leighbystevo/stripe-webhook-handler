import Stripe from 'stripe';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export async function handleWebhookEvent(event: Stripe.Event) {
  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const { tenantId } = account.metadata;
        
        if (tenantId) {
          const configRef = doc(db, 'tenantConfig', tenantId);
          await updateDoc(configRef, {
            'stripeSettings.payoutsEnabled': account.payouts_enabled,
            'stripeSettings.bankAccount': account.external_accounts?.data[0] ? {
              last4: account.external_accounts.data[0].last4,
              bankName: account.external_accounts.data[0].bank_name
            } : null,
            updatedAt: serverTimestamp()
          });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { sponsorshipId } = paymentIntent.metadata;

        if (sponsorshipId) {
          const sponsorshipRef = doc(db, 'sponsorships', sponsorshipId);
          await updateDoc(sponsorshipRef, {
            paymentStatus: 'paid',
            status: 'paid',
            paymentDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { sponsorshipId } = paymentIntent.metadata;

        if (sponsorshipId) {
          const sponsorshipRef = doc(db, 'sponsorships', sponsorshipId);
          await updateDoc(sponsorshipRef, {
            paymentStatus: 'failed',
            paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
            updatedAt: serverTimestamp(),
          });
        }
        break;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling webhook:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}