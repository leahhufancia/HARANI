import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, MapPin, ShoppingBasket, Sprout } from 'lucide-react';
import ProductCard from '../../components/marketplace/ProductCard';
import ProduceImage from '../../components/marketplace/ProduceImage';
import useDemoData from '../../hooks/useDemoData';
import { getListings } from '../../services/produceService';

const paths = [
  {
    role: 'For farmers',
    icon: Sprout,
    intro: 'Your harvest. Your price. Your next buyer.',
    steps: [
      ['List your harvest', 'Add a photo, set your price and quantity, and share your pickup location.'],
      ['Confirm a reservation', 'Review incoming requests and agree on a handover with your buyer.'],
      ['Make the handover', 'Use the Digital Harvest Pass to complete the exchange and record the sale.'],
    ],
    to: '/register?role=farmer',
    cta: 'Start selling',
  },
  {
    role: 'For buyers',
    icon: ShoppingBasket,
    intro: 'Good local produce, in the quantity you need.',
    steps: [
      ['Find your produce', 'Explore local listings, compare prices, and get to know the grower.'],
      ['Reserve what you need', 'Choose your quantity and send a reservation directly to the farmer.'],
      ['Collect and confirm', 'Arrange pickup or delivery, present your harvest pass, and track the completed purchase.'],
    ],
    to: '/marketplace',
    cta: 'Explore the marketplace',
  },
];

export default function LandingPage() {
  const data = useDemoData();
  const previewListings = getListings(data)
    .filter((listing) => listing.status === 'active' && listing.farmer?.status === 'active')
    .slice(0, 3);

  return (
    <div>
      <section aria-labelledby="home-heading" className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
        <div className="grid items-center gap-9 lg:grid-cols-[1.08fr_1fr] lg:gap-12">
          <div>
            <p className="eyebrow mb-5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
              Closer to the harvest
            </p>
            <h1 id="home-heading" className="max-w-2xl text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.055em] text-black sm:text-5xl xl:text-[3.65rem]">
              A harvest shouldn't lose its value waiting for a buyer.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-black/65 sm:text-lg">
              Harani connects local farmers with nearby buyers, making it easier to sell surplus vegetables and find affordable local produce.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/marketplace" className="btn btn-primary">
                Find Produce <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/register?role=farmer" className="btn btn-secondary">
                Sell Your Harvest
              </Link>
            </div>
            <p className="mt-5 text-xs font-medium leading-relaxed text-black/60">
              Browse freely. Connect directly. Reserve only what you need.
            </p>
          </div>

          <figure className="overflow-hidden rounded-md border border-black/10 bg-black/5">
            <div className="relative">
              <ProduceImage
                src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=85"
                alt="A colorful selection of fresh vegetables at a produce market"
                eager
                className="h-72 w-full object-cover sm:h-96 lg:h-[420px]"
              />
              <span className="absolute left-4 top-4 rounded-full bg-[#D0BE00] px-4 py-2 text-xs font-bold text-black sm:left-5 sm:top-5">
                Good food. Less waste.
              </span>
            </div>
            <figcaption className="flex items-center justify-between gap-4 bg-black px-5 py-5 text-white sm:px-6">
              <div>
                <p className="text-xs text-white/60">From the source, for your table</p>
                <p className="mt-1 text-sm font-semibold">A better place for every harvest.</p>
              </div>
              <Sprout className="h-7 w-7 shrink-0 text-[#D0BE00]" strokeWidth={1.5} aria-hidden="true" />
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="preview-heading" className="border-y border-black/10 bg-black/[0.025] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow mb-3">A taste of the marketplace</p>
              <h2 id="preview-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">Good produce. New possibilities.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">
                Demo listings from our shared marketplace. Explore a harvest, choose a quantity, and try the reservation journey.
              </p>
            </div>
            <Link to="/marketplace" className="inline-flex shrink-0 items-center gap-2 self-start rounded py-2 text-sm font-bold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green sm:self-auto">
              View all produce <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {previewListings.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {previewListings.map((listing) => <ProductCard key={listing.id} listing={listing} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white px-6 py-10 text-center">
              <Sprout className="mx-auto mb-4 h-8 w-8 text-green" aria-hidden="true" />
              <h3 className="font-bold">The next harvest starts with you.</h3>
              <p className="mt-2 text-sm text-black/60">There are no active demo listings right now.</p>
              <Link to="/register?role=farmer" className="btn btn-primary mt-5">Sell Your Harvest</Link>
            </div>
          )}
          <p className="mt-5 text-xs leading-relaxed text-black/60">Sample data for exploration, not an offer of real produce. No real payments are collected.</p>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="mx-auto max-w-7xl scroll-mt-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow mb-3">How It Works</p>
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">Two ways in. A shared way forward.</h2>
          <p className="mt-3 text-sm leading-relaxed text-black/60">A simple path from the people who grow our food to the people who need it.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {paths.map(({ role, icon: Icon, intro, steps, to, cta }) => (
            <article key={role} className="rounded-md border border-black/15 p-6 sm:p-8">
              <div className="mb-7 flex items-start gap-4">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${role === 'For farmers' ? 'bg-green/10 text-green' : 'bg-[#D0BE00]/20 text-black'}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xl font-bold">{role}</h3>
                  <p className="mt-1 text-sm text-black/60">{intro}</p>
                </div>
              </div>
              <ol className="space-y-6">
                {steps.map(([title, description], index) => (
                  <li key={title} className="flex gap-4">
                    <span className="pt-0.5 text-sm font-bold tabular-nums text-black/65" aria-hidden="true">0{index + 1}</span>
                    <div>
                      <h4 className="text-sm font-bold">{title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-black/60">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to={to} className="mt-7 inline-flex items-center gap-2 rounded text-sm font-bold text-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-green">
                {cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="benefits-heading" className="border-y border-black/10 bg-black px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="eyebrow mb-3 text-[#D0BE00]">Why Harani</p>
          <h2 id="benefits-heading" className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">More value in every connection.</h2>
          <div className="mt-9 grid gap-9 md:grid-cols-2 md:gap-12">
            <div>
              <h3 className="mb-5 border-b border-white/20 pb-4 text-lg font-semibold">Benefits for farmers</h3>
              <ul className="space-y-5">
                {[
                  ['List surplus produce', 'Find a buyer for a good harvest before it loses its value.'],
                  ['Set prices and selling deadlines', 'Stay in control of your produce, timing, and pricing.'],
                  ['Manage reservations', 'Review requests and prepare just the quantities your buyers need.'],
                  ['Track every handover', 'Keep a clear record of produce collected or delivered.'],
                ].map(([title, description]) => (
                  <li key={title} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D0BE00]" aria-hidden="true" />
                    <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-sm leading-relaxed text-white/60">{description}</p></div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-5 border-b border-white/20 pb-4 text-lg font-semibold">Benefits for buyers</h3>
              <ul className="space-y-5">
                {[
                  ['Discover local produce', 'Get to know the growers behind your next meal.'],
                  ['Compare prices and quantities', 'Find an offer that fits your household or food business.'],
                  ['Reserve just what you need', 'Choose smaller or larger quantities without buying the whole harvest.'],
                  ['Track your reservations', 'Follow farmer confirmations, handovers, and completed purchases in your workspace.'],
                ].map(([title, description]) => (
                  <li key={title} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D0BE00]" aria-hidden="true" />
                    <div><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-sm leading-relaxed text-white/60">{description}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="about" aria-labelledby="about-heading" className="mx-auto grid max-w-7xl scroll-mt-6 gap-6 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-12 lg:px-8">
        <div>
          <p className="eyebrow mb-3">About Harani</p>
          <h2 id="about-heading" className="max-w-sm text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Local food.<br />A shared future.</h2>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-green" aria-hidden="true" />Built around community</span>
        </div>
        <div className="space-y-4 text-base leading-relaxed text-black/65">
          <p>Harani is a digital marketplace designed to bridge the gap between local farmers and buyers. We believe that fresh, locally-grown produce should be accessible to everyone, and farmers deserve fair compensation for their hard work.</p>
          <p>Our platform makes it simple to connect, transact, and build lasting relationships within your community, from households to carenderias, restaurants, and other local food businesses.</p>
          <p className="border-l-2 border-[#D0BE00] pl-4 text-sm">This frontend demo lets you explore that idea from every side. Accounts, listings, reservations, and handovers are simulated in your browser.</p>
        </div>
      </section>

      <section aria-labelledby="start-heading" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="flex flex-col justify-between gap-7 rounded-md border border-green/15 bg-green/5 px-6 py-8 sm:px-9 md:flex-row md:items-center">
          <div>
            <p className="eyebrow mb-3">Your next connection starts here</p>
            <h2 id="start-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Give a good harvest a good home.</h2>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link to="/marketplace" className="btn btn-primary">Find Produce <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
            <Link to="/register?role=farmer" className="btn btn-secondary">Sell Your Harvest</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
