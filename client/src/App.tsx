import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
const NotFound=lazy(()=>import("@/pages/NotFound"));
const SearchPage=lazy(()=>import("@/pages/Search"));
import Home from "@/pages/Home";
const Collections=lazy(()=>import("@/pages/Collections"));
const ListDetail=lazy(()=>import("@/pages/ListDetail"));
const Pricing=lazy(()=>import("@/pages/Pricing"));
const WorkDetail=lazy(()=>import("@/pages/WorkDetail"));
const Settings=lazy(()=>import("@/pages/Settings"));
const Learn=lazy(()=>import("@/pages/Learn"));
const LearnStats=lazy(()=>import("@/pages/LearnStats"));
const Landing=lazy(()=>import("@/pages/Landing"));
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider, useI18n } from "./i18n/I18nContext";
import { StoreProvider } from "./store/StoreContext";

function Router() {
  const {t}=useI18n();
  return (
    <Suspense fallback={<div role="status" aria-live="polite" style={{padding:"48px",textAlign:"center"}}>{t("loading")}</div>}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchPage} />
      <Route path="/work/:id" component={WorkDetail} />
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
    </Suspense>
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
