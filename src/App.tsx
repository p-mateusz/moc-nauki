import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, resetQueryCache } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import About from "./pages/About";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterPlan from "./pages/RegisterPlan";
import RegisterSuccess from "./pages/RegisterSuccess";
import Pricing from "./pages/Pricing";
import MocDashboard from "./pages/MocDashboard";
import CreateList from "./pages/CreateList";
import Practice from "./pages/Practice";
import FlashCards from "./pages/FlashCards";
import Quiz from "./pages/Quiz";
import ListDetail from "./pages/ListDetail";
import ShareImport from "./pages/ShareImport";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import RecordingWidget from "./components/dashboard/RecordingWidget";



const App = () => {
  // Globalny strażnik: jeśli Supabase wyemituje SIGNED_OUT (np. wygaśnięcie
  // sesji, wylogowanie z innej karty), wyczyść cache React Query, żeby
  // żadne stare dane nie wyciekły do kolejnego użytkownika.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        resetQueryCache();
      }
    });

    // Po powrocie z tła nie dotykamy metod Auth synchronicznie — w niektórych
    // wersjach klienta potrafią zawiesić wewnętrzny lock. Wystarczy wznowić
    // zapytania i pozwolić klientowi samemu odświeżyć token przy requestach.
    const reviveSession = () => {
      if (document.visibilityState !== "visible") return;
      window.setTimeout(() => {
        queryClient.resumePausedMutations().catch(() => {});
        queryClient.invalidateQueries({ refetchType: "active" });
      }, 0);
    };

    document.addEventListener("visibilitychange", reviveSession);
    window.addEventListener("focus", reviveSession);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", reviveSession);
      window.removeEventListener("focus", reviveSession);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPlan />} />
          <Route path="/register/success" element={<RegisterSuccess />} />
          <Route path="/register/account" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/dashboard" element={<MocDashboard />} />
          <Route path="/create" element={<CreateList />} />
          <Route path="/practice/:listId" element={<Practice />} />
          <Route path="/flashcards/:listId" element={<FlashCards />} />
          <Route path="/quiz/:listId" element={<Quiz />} />
          <Route path="/list/:listId" element={<ListDetail />} />
          <Route path="/share/:listId" element={<ShareImport />} />
          <Route path="/s/:slug" element={<ShareImport />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <RecordingWidget />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
