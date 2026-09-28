const MockPaymentProvider = require('./MockPaymentProvider');

const providers = {
  DEVELOPMENT_MOCK: new MockPaymentProvider(),
};

function getPaymentProvider(providerName) {
  const selected = providerName || process.env.PAYMENT_PROVIDER || 'DEVELOPMENT_MOCK';
  if (providers[selected]) {
    return providers[selected];
  }
  // Default fallback to mock provider in dev/sandbox
  return providers.DEVELOPMENT_MOCK;
}

module.exports = {
  getPaymentProvider,
  MockPaymentProvider,
};
