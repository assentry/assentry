import { Footer } from "../../../components/marketing/Footer";
import { HowItWorks } from "../../../components/marketing/HowItWorks";

export const metadata = { title: "How it works · Assentry" };

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen bg-navy-950">
      <HowItWorks />
      <Footer />
    </div>
  );
}
