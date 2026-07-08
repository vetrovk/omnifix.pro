import { Hero } from "./components/Hero";
import { LiveEngineeringFeed } from "./components/LiveEngineeringFeed";
import { activityFeed } from "./data/activityFeed";

export default function App() {
  return (
    <div
      className="h-screen bg-[#060609] flex flex-col overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Hero />
      <LiveEngineeringFeed items={activityFeed} />
    </div>
  );
}
