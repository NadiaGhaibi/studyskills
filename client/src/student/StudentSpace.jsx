import { useState } from "react";
import { Tabs } from "../common.jsx";
import Team from "./Team.jsx";
import Deposit from "./Deposit.jsx";
import Works from "./Works.jsx";
import { AnnoncesList } from "../Annonces.jsx";
import { CoursList } from "../Cours.jsx";

// Espace étudiant : annonces, cours, gestion de l'équipe, dépôt, consultation (portfolio + notes)
export default function StudentSpace({ me }) {
  const [tab, setTab] = useState("ann");
  return (
    <>
      <Tabs
        tab={tab}
        set={setTab}
        tabs={[
          ["ann", "📢 Annonces"],
          ["cours", "📚 Cours"],
          ["team", "👥 Mon équipe"],
          ["dep", "⬆️ Déposer un travail"],
          ["works", "📁 Mes travaux & notes"],
        ]}
      />
      {tab === "ann" && <AnnoncesList />}
      {tab === "cours" && <CoursList />}
      {tab === "team" && <Team me={me} />}
      {tab === "dep" && <Deposit onDone={() => setTab("works")} />}
      {tab === "works" && <Works />}
    </>
  );
}
