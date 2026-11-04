import { ArchitectureDiagram } from "../components/marketing/ArchitectureDiagram";
import { Footer } from "../components/marketing/Footer";
import { Hero } from "../components/marketing/Hero";
import { Nav } from "../components/marketing/Nav";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <Nav />
      <Hero />
      <ArchitectureDiagram />
      <Footer />
    </div>
  );
}
