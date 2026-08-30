import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Collections from "@/pages/Collections";
import ListDetail from "@/pages/ListDetail";
import Pricing from "@/pages/Pricing";
import Settings from "@/pages/Settings";
import Learn from "@/pages/Learn";
import LearnStats from "@/pages/LearnStats";
import Landing from "@/pages/Landing";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/I18nContext";
import { StoreProvider } from "./store/StoreContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/collections" component={Collections} />
      <Route path="/list/:id" component={ListDetail} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/settings" component={Settings} />
      <Route path="/welcome" component={Landing} />
      <Route path="/learn/stats" component={LearnStats} />
      <Route path="/learn" component={Learn} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <I18nProvider>
          <StoreProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </StoreProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
