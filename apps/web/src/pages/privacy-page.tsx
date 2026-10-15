import { PRIVACY_POLICY_VERSION } from "@athletept/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Logo } from "@/components/layout/logo";
import { Alert } from "@/components/ui/alert";
import { formatIsoDate } from "@/lib/format";

/*
 * PLATZHALTER: Dieser Text ist keine geprüfte Datenschutzerklärung. Vor dem Livegang muss er
 * rechtlich geprüft und vervollständigt werden. Bei jeder inhaltlichen Änderung
 * PRIVACY_POLICY_VERSION in packages/shared/src/legal.ts hochsetzen.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="text-muted flex flex-col gap-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <mark className="bg-inset text-text rounded px-1">[{children}]</mark>;
}

/** Öffentlich erreichbar, auch ohne Anmeldung (verlinkt aus der Einladung). */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-10">
      <title>Datenschutzerklärung · AthletePT</title>
      <Link to="/" className="self-start" aria-label="AthletePT, zur Startseite">
        <Logo />
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium">Datenschutzerklärung</h1>
        <p className="text-muted text-sm">
          Stand {formatIsoDate(PRIVACY_POLICY_VERSION)} (Version {PRIVACY_POLICY_VERSION})
        </p>
      </header>

      <Alert variant="warning" title="Platzhalter: rechtlich prüfen lassen">
        Dieser Text ist ein Entwurf und keine rechtsverbindliche Datenschutzerklärung. Er muss vor
        dem Livegang von einer fachkundigen Stelle geprüft und vervollständigt werden.
      </Alert>

      <Section title="1. Verantwortlicher">
        <p>
          <Placeholder>Name, Anschrift, E-Mail des Betreibers</Placeholder>
        </p>
        <p>
          Datenschutzbeauftragte:r: <Placeholder>falls benannt, Kontaktdaten</Placeholder>
        </p>
      </Section>

      <Section title="2. Welche Daten wir verarbeiten">
        <p>
          Kontodaten (Name, E-Mail-Adresse, Passwort als Hash), Angaben aus deiner Anamnese (z. B.
          Geburtsdatum, Größe, Ziele, körperliche Beschwerden, Vorerkrankungen) sowie Trainingspläne
          und -protokolle.
        </p>
      </Section>

      <Section title="3. Gesundheitsdaten (Art. 9 DSGVO)">
        <p>
          Angaben zu körperlichen Beschwerden und Vorerkrankungen sowie deine Trainingsprotokolle
          sind Gesundheitsdaten. Wir verarbeiten sie nur mit deiner ausdrücklichen Einwilligung
          (Art. 9 Abs. 2 lit. a DSGVO), die du beim Aktivieren deines Kontos erteilst. Wir
          speichern, wann und zu welcher Version dieser Erklärung du eingewilligt hast.
        </p>
        <p>
          Du kannst die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen:{" "}
          <Placeholder>Weg des Widerrufs, z. B. E-Mail-Adresse</Placeholder>. Die Verarbeitung bis
          zum Widerruf bleibt rechtmäßig. Ohne Einwilligung ist eine Betreuung über AthletePT nicht
          möglich.
        </p>
      </Section>

      <Section title="4. Zweck und Empfänger">
        <p>
          Die Daten dienen dazu, dass dein Coach dich betreuen und Trainingspläne für dich erstellen
          kann. Zugriff haben nur du und dein Coach. Wechselt dein Coach, übernimmt ein anderer
          Coach deine Betreuung.
        </p>
        <p>
          Auftragsverarbeiter:{" "}
          <Placeholder>Hosting-Anbieter, Mailversand (Resend), Standort der Server</Placeholder>
        </p>
      </Section>

      <Section title="5. Speicherdauer">
        <p>
          <Placeholder>
            Speicherdauer, Löschung nach Ende der Betreuung, Aufbewahrungspflichten
          </Placeholder>
        </p>
      </Section>

      <Section title="6. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit und Widerspruch sowie das Recht, dich bei einer
          Datenschutz-Aufsichtsbehörde zu beschweren.{" "}
          <Placeholder>zuständige Aufsichtsbehörde</Placeholder>
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>
          Wir setzen nur ein technisch notwendiges Cookie, das dich angemeldet hält. Es gibt kein
          Tracking und keine Werbung.
        </p>
      </Section>
    </main>
  );
}
