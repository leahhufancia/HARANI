const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amounts = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

export const money = (value = 0) => pesos.format(Number.isFinite(Number(value)) ? Number(value) : 0);
export const quantity = (value = 0) => amounts.format(Number.isFinite(Number(value)) ? Number(value) : 0);
export const shortDate = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not provided';
export const dateTime = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not provided';
export const urgencyLabel = (value) => ({ 'sell-now': 'Sell Now', 'sell-today': 'Sell Today', planned: 'Planned Surplus' }[value] || value);
