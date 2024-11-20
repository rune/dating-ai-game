import type { RuneClient } from "rune-sdk"

export type AIMessage = {
  role: string
  content: string
}

export interface GameState {
  playerAnswers: Record<string, string>
  aiHistory: AIMessage[]
}

type GameActions = {
  answer: (answer: string) => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 2,
  setup: () => {
    return {
      playerAnswers: {},
      aiHistory: [],
    }
  },
  actions: {
    answer: (answer, { game, allPlayerIds }) => {

    }
  },
})
