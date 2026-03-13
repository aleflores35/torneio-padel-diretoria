const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (player, tournament) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'brl',
          product_data: {
            name: `Inscrição: ${tournament.name}`,
            description: `Atleta: ${player.name}`,
          },
          unit_amount: Math.round(tournament.entry_fee * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/pagamento-sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/atletas`,
    customer_email: player.email || null,
    metadata: {
      id_player: player.id_player,
      id_tournament: tournament.id_tournament,
    },
  });

  return session;
};

module.exports = { createCheckoutSession };
