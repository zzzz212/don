import { z } from "zod";

// Output of POST /api/deals/.../suggest-moves. Exactly 3 moves, one
// per archetype: A = accept the counter-position, B = compromise with
// concrete proposed text, C = stand firm with rationale.

export const MoveSchema = z.object({
  id: z.enum(["A", "B", "C"]),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(800),
  proposedText: z.string().max(2000).nullable().optional(),
});

export const MovesSchema = z.object({
  moves: z.array(MoveSchema).length(3),
});

export type Move = z.infer<typeof MoveSchema>;
export type Moves = z.infer<typeof MovesSchema>;
