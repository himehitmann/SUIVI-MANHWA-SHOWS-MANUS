import { useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/i18n/I18nContext";

const steps = [
 {en:["Find your next story", "Search for a title, open its details, and check the edition before saving.", "Search", "Example title", "Open details"], fr:["Trouve ta prochaine lecture", "Cherche un titre, ouvre sa fiche et vérifie la version avant de l’ajouter.", "Rechercher", "Titre d’exemple", "Ouvrir la fiche"]},
 {en:["Choose where to keep it", "Choose a list explicitly. You can create one and change your choice later in the library.", "Destination", "My reading list", "Add to this list"], fr:["Choisis où la ranger", "Choisis une liste. Tu peux en créer une et modifier ce choix ensuite dans la bibliothèque.", "Destination", "Mes lectures", "Ajouter à cette liste"]},
 {en:["Keep your place", "On a supported reading or video page, use the extension to save your chapter or episode. Resume it from your library.", "Your position", "Chapter 12", "Save my position"], fr:["Garde ta progression", "Sur une page de lecture ou vidéo compatible, enregistre ton chapitre ou épisode avec l’extension. Reprends-le depuis la bibliothèque.", "Ta progression", "Chapitre 12", "Enregistrer ma position"]},
 {en:["Read in your language", "In the extension, select the source and target languages, then Translate. Auto on this site applies to that site only; Restore shows the original again. Detected text is sent to a translation service, whose limits apply.", "Translation", "Korean → English", "Translate"], fr:["Lis dans ta langue", "Dans l’extension, choisis les langues puis Translate. Auto on this site active ce mode pour ce site seulement ; Restore rétablit l’original. Le texte détecté est envoyé au service de traduction, selon ses limites.", "Traduction", "Coréen → Français", "Traduire"]}
];
export function QuickTour() {
 const {lang}=useI18n(); const fr=lang==="fr"; const [step,setStep]=useState(0); const current=steps[step][fr?"fr":"en"];
 return <section id="guide" className="quick-tour" aria-labelledby="tour-heading">
  <div><h2 id="tour-heading">{fr?"Yomu, étape par étape":"Yomu, step by step"}</h2><p>{fr?"Un aperçu interactif des commandes. Aucune donnée n’est ajoutée à ta bibliothèque ici.":"An interactive guide to the controls. This preview does not add anything to your library."}</p></div>
  <div className="tour-steps" aria-label={fr?"Étapes du guide":"Guide steps"}>{steps.map((s,i)=><button type="button" key={i} aria-current={step===i?"step":undefined} onClick={()=>setStep(i)}>{i+1}. {s[fr?"fr":"en"][0]}</button>)}</div>
  <div className="tour-content">
   <div className="tour-preview" role="img" aria-label={fr?"Illustration de la commande : "+current[4]:"Illustration of the control: "+current[4]}>
    <span className="tour-example">{fr?"Exemple illustré":"Illustrated example"}</span><strong>Yomu</strong><span>{current[2]}</span><div className="tour-value">{current[3]}</div><span className="tour-control">{current[4]}</span>
   </div>
   <div aria-live="polite"><p className="tour-count">{step+1} / {steps.length}</p><h3>{current[0]}</h3><p>{current[1]}</p>
    <div className="tour-navigation"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>{fr?"Précédent":"Previous"}</button>{step<steps.length-1?<button type="button" onClick={()=>setStep(s=>s+1)}>{fr?"Suivant":"Next"}</button>:<Link href="/search">{fr?"Explorer le catalogue":"Explore the catalogue"}</Link>}</div>
   </div>
  </div>
 </section>;
}

