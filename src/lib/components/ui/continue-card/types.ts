/** One Continue watching card: a whole-card link to /watch/<fileId>. Ids and labels only. */
export interface ContinueCardItem {
	fileId: string;
	href: string; // /watch/<fileId>
	title: string; // film title or show name
	eyebrow: string; // "2021" for a film, "S5 · E1 · Chapitre un" for an episode
	stillPath: string | null; // TMDB 16:9 image path (episode still, else backdrop)
	progress: number; // watched fraction 0..1
	remainingLabel: string; // "41 min left"
	ariaLabel: string; // "Resume Stranger Things, season 5 episode 1, Chapitre un, 41 minutes left"
}
