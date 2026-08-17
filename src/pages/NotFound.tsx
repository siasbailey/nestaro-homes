import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-[#c47a45] mb-3">404</p>
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-[#26342b] mb-4">Page Not Found</h1>
        <p className="text-sm text-gray-500 mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/">
            <Button className="bg-[#26342b] text-white w-full sm:w-auto">Back to Home</Button>
          </Link>
          <Link to="/invest">
            <Button variant="outline" className="border-[#26342b] text-[#26342b] w-full sm:w-auto">
              Explore Home Plans
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
