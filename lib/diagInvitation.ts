/**
 * DIAGNOSTIC TEMPORAIRE (RAPPORT §24) — À SUPPRIMER une fois la cause du « Code d'invitation invalide » trouvée :
 * supprimer ce fichier et les deux appels marqués `DIAG-INVITATION` dans `lib/routes/inscription-prof.ts`.
 *
 * Écrit UNE ligne `DIAG-INVITATION {json}` par étape dans les logs de la fonction (Vercel). Ne modifie JAMAIS le
 * comportement de la route (tout est dans un try/catch, rien n'est renvoyé au client). Ne journalise ni mot de
 * passe, ni email, ni clé : seulement ce que le professeur a saisi comme code (à sa demande), les champs d'erreur
 * PostgREST, l'hôte de SUPABASE_URL et les revendications publiques `role`/`ref` du JWT de la clé de service.
 */

/** Points de code (hexadécimal) de chaque caractère : un espace insécable, un U+200B ou un tiret typographique y apparaissent. */
export function pointsDeCode(texte: string): string[] {
  return [...texte].map((c) => c.codePointAt(0)!.toString(16).padStart(4, "0"));
}

/** Revendications NON secrètes (`role`, `ref`, `iss`) du JWT de la clé de service — jamais la clé elle-même. */
function revendicationsCle(cle: string | undefined): Record<string, unknown> {
  try {
    const payload = JSON.parse(Buffer.from((cle ?? "").split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;
    return { role: payload.role, ref: payload.ref, iss: payload.iss };
  } catch {
    return { illisible: true, longueurCle: (cle ?? "").length, nbSegments: (cle ?? "").split(".").length };
  }
}

function hoteSupabase(): string {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").host;
  } catch {
    return `URL illisible (longueur ${(process.env.SUPABASE_URL ?? "").length})`;
  }
}

function ecrire(etape: string, donnees: Record<string, unknown>): void {
  try {
    console.log("DIAG-INVITATION " + JSON.stringify({ etape, ...donnees }));
  } catch {
    /* un diagnostic ne casse jamais la route */
  }
}

/** AVANT l'appel Supabase : le code tel que reçu (avant `.trim()`), son écho JSON, ses points de code, l'environnement. */
export function diagAvant(brut: unknown, apresTrim: string): void {
  const texte = typeof brut === "string" ? brut : "";
  ecrire("avant", {
    typeRecu: typeof brut,
    recu: texte,
    longueurRecu: texte.length,
    longueurApresTrim: apresTrim.length,
    pointsDeCodeRecu: pointsDeCode(texte.slice(0, 120)),
    hoteSupabaseUrl: hoteSupabase(),
    cleService: revendicationsCle(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}

interface ErreurPostgrest {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * APRÈS l'appel Supabase : erreur de requête (distincte de « aucune ligne »), présence de la ligne, puis — seulement
 * quand la route va répondre « invalide » — une lecture de contrôle de `invitations_prof` : nombre de lignes vu par
 * le serveur et, pour chaque ligne (10 max), comparaison AVEC le code saisi sans jamais écrire le code stocké.
 */
export async function diagApres(
  admin: { from: (t: string) => any },
  codeCherche: string,
  resultat: { data: unknown; error: ErreurPostgrest | null },
): Promise<void> {
  try {
    const e = resultat.error;
    ecrire("apres", {
      erreurRequete: e ? { message: e.message, code: e.code, details: e.details, hint: e.hint } : null,
      ligneTrouvee: resultat.data != null,
      decision: e ? "ERREUR_DE_REQUETE" : resultat.data == null ? "AUCUNE_LIGNE" : "TROUVE",
    });
    if (!e && resultat.data != null) return;
    const controle = await admin.from("invitations_prof").select("code, utilise", { count: "exact" }).limit(50);
    const lignes: { code?: unknown; utilise?: unknown }[] = Array.isArray(controle.data) ? controle.data : [];
    const minuscule = codeCherche.toLowerCase();
    ecrire("controle", {
      erreurControle: controle.error ? { message: controle.error.message, code: controle.error.code, details: controle.error.details, hint: controle.error.hint } : null,
      nombreLignesVues: lignes.length,
      compteExact: controle.count ?? null,
      lignes: lignes.slice(0, 10).map((l) => {
        const stocke = typeof l.code === "string" ? l.code : "";
        return {
          longueurStocke: stocke.length,
          egalExact: stocke === codeCherche,
          egalApresTrimDuStocke: stocke.trim() === codeCherche,
          egalSansCasse: stocke.toLowerCase() === minuscule,
          caracteresHorsHexTiret: [...stocke].filter((c) => !/[0-9a-fA-F-]/.test(c)).map((c) => c.codePointAt(0)!.toString(16)),
          utilise: l.utilise,
        };
      }),
    });
  } catch (err) {
    ecrire("diag-erreur", { message: err instanceof Error ? err.message : String(err) });
  }
}
