import { and, eq } from 'drizzle-orm';
import {
	ALAN_SCORE_DIMENSIONS,
	calculateAlanScore,
	normalizeAlanScoreTags,
	type AlanScoreStatus,
	type AlanScoreValues
} from '$lib/alan-score';
import { db } from '$lib/server/db';
import { moviePersonalScores } from '$lib/server/db/schema';
import { resolveMovieUuid } from './interaction.service';

const MAX_NOTE_LENGTH = 2_000;

export type AlanScoreInput = {
	values: AlanScoreValues;
	note?: string | null;
	tags?: Iterable<string>;
};

export type AlanScoreView = {
	id: string;
	movieId: string;
	values: AlanScoreValues;
	score: number | null;
	coverage: number;
	status: AlanScoreStatus;
	note: string | null;
	tags: string[];
	createdAt: Date;
	updatedAt: Date;
};

function numberOrNull(value: string | null): number | null {
	return value === null ? null : Number(value);
}

function toView(row: typeof moviePersonalScores.$inferSelect): AlanScoreView {
	return {
		id: row.id,
		movieId: row.movieId,
		values: Object.fromEntries(
			ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, numberOrNull(row[key])])
		) as AlanScoreValues,
		score: numberOrNull(row.computedScore),
		coverage: row.coverage,
		status: row.status as AlanScoreStatus,
		note: row.note,
		tags: row.tags,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

export async function readAlanScore(
	userId: string,
	movieId: string
): Promise<AlanScoreView | null> {
	const resolvedMovieId = await resolveMovieUuid(movieId);
	if (!resolvedMovieId) return null;

	const row = await db.query.moviePersonalScores.findFirst({
		where: and(
			eq(moviePersonalScores.userId, userId),
			eq(moviePersonalScores.movieId, resolvedMovieId)
		)
	});
	return row ? toView(row) : null;
}

export async function upsertAlanScore(
	userId: string,
	movieId: string,
	input: AlanScoreInput
): Promise<AlanScoreView | null> {
	const resolvedMovieId = await resolveMovieUuid(movieId);
	if (!resolvedMovieId) return null;

	const calculation = calculateAlanScore(input.values);
	const note = input.note?.trim() || null;
	if (note && note.length > MAX_NOTE_LENGTH) {
		throw new RangeError(
			`Notes must be ${MAX_NOTE_LENGTH.toLocaleString('en-US')} characters or fewer.`
		);
	}
	const tags = normalizeAlanScoreTags(input.tags ?? []);
	const now = new Date();
	const dimensions = Object.fromEntries(
		ALAN_SCORE_DIMENSIONS.map(({ key }) => [key, input.values[key]?.toFixed(1) ?? null])
	) as Record<keyof AlanScoreValues, string | null>;
	const values = {
		userId,
		movieId: resolvedMovieId,
		...dimensions,
		computedScore: calculation.score?.toFixed(1) ?? null,
		coverage: calculation.coverage,
		status: calculation.status,
		note,
		tags,
		updatedAt: now
	};

	const [row] = await db
		.insert(moviePersonalScores)
		.values(values)
		.onConflictDoUpdate({
			target: [moviePersonalScores.userId, moviePersonalScores.movieId],
			set: values
		})
		.returning();

	return row ? toView(row) : null;
}

export async function resetAlanScore(userId: string, movieId: string): Promise<boolean> {
	const resolvedMovieId = await resolveMovieUuid(movieId);
	if (!resolvedMovieId) return false;

	const deleted = await db
		.delete(moviePersonalScores)
		.where(
			and(eq(moviePersonalScores.userId, userId), eq(moviePersonalScores.movieId, resolvedMovieId))
		)
		.returning({ id: moviePersonalScores.id });
	return deleted.length > 0;
}
