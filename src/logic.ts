import type { GameOverResult, PlayerId, RuneClient } from "rune-sdk"
import { INTRO_PROMPT, runPrompt } from "./prompt"

type Prompt = { role: string; content: string }

export const QUESTION_PERIOD = 1000 * 60
export const PAUSE_PERIOD = 1000 * 15
export const INTRO_PERIOD = 1000 * 10

export interface GameState {
  playerNames: Record<string, string>
  playerAnswers: Record<string, string>
  playerSummaries: Record<string, string>
  aiResponses: Record<string, string>
  aiHistory: Prompt[]
  prompting: boolean
  introDone: boolean
  contestantIntroDone: boolean
  question: string | null
  questionNumber: number
  introText: string
  decisionText: string
  dateText: string
  playerAnswersDone: boolean
  questionEndTime: number
  responseEndTime: number
  responseIdsToShow: string[]
  questionCount: number
  showResultTime: number
  startQuestionsTime: number
  gameOverAt: number
  ready: Record<string, boolean>
  winner: string
}

type GameActions = {
  answer: (params: { name: string; answer: string }) => void
  next: () => void
  ready: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 6,
  setup: () => {
    return {
      playerNames: {},
      playerAnswers: {},
      playerSummaries: {},
      aiResponses: {},
      aiHistory: [],
      prompting: false,
      introDone: false,
      contestantIntroDone: false,
      question: null,
      questionNumber: 1,
      introText: "",
      decisionText: "",
      dateText: "",
      playerAnswersDone: false,
      questionEndTime: 0,
      responseEndTime: 0,
      responseIdsToShow: [],
      questionCount: 0,
      showResultTime: 0,
      startQuestionsTime: 0,
      gameOverAt: 0,
      ready: {},
      winner: "",
    }
  },
  updatesPerSecond: 10,
  update: ({ game, allPlayerIds }) => {
    // run an update loop for the timer
    if (
      game.playerAnswersDone &&
      game.responseEndTime < Rune.gameTime() &&
      game.responseEndTime !== 0
    ) {
      game.questionEndTime = Rune.gameTime() + QUESTION_PERIOD
      game.responseEndTime = 0
      game.playerAnswersDone = false
      game.playerAnswers = {}
      game.aiResponses = {}

      if (Object.keys(game.playerSummaries).length > 0) {
        game.showResultTime = Rune.gameTime() + PAUSE_PERIOD
      }
    }

    if (
      game.startQuestionsTime !== 0 &&
      game.startQuestionsTime < Rune.gameTime()
    ) {
      game.startQuestionsTime = 0
      game.contestantIntroDone = true
      game.questionEndTime = Rune.gameTime() + QUESTION_PERIOD
    }

    if (game.showResultTime !== 0 && game.showResultTime < Rune.gameTime()) {
      if (game.gameOverAt === 0) {
        game.gameOverAt = Rune.gameTime() + PAUSE_PERIOD
      }
    }

    if (game.gameOverAt !== 0 && game.gameOverAt < Rune.gameTime()) {
      const options: Record<PlayerId, GameOverResult> = {}
      for (const id of allPlayerIds) {
        options[id] = game.winner === id ? "WON" : "LOST"
      }
      Rune.gameOver({ players: options, minimizePopUp: true })
    }
  },
  events: {
    playerJoined: () => {
      // do nothing but allow it
    },
    playerLeft: () => {
      // do nothing but allow it
    },
  },
  ai: {
    promptResponse: ({ response }, { game, allPlayerIds }) => {
      game.prompting = false

      game.aiHistory.push({
        role: "assistant",
        content: response,
      })

      game.responseIdsToShow = []
      if (game.startQuestionsTime === 0) {
        game.startQuestionsTime = Rune.gameTime() + INTRO_PERIOD
      }
      const lines = response.split("\n")
      for (const line of lines) {
        if (line.startsWith("Intro:")) {
          game.introText = line.substring("Intro:".length)
        }
        if (line.startsWith("Date:")) {
          game.dateText = line.substring("Date:".length)
        }
        if (line.startsWith("Question:")) {
          game.questionCount++
          game.question = line.substring("Question:".length)
          game.questionEndTime = Rune.gameTime() + QUESTION_PERIOD
          game.ready = {}
        }
        if (line.startsWith("Decision:")) {
          game.decisionText = line.substring("Decision:".length)
          for (const id in game.playerNames) {
            if (
              game.decisionText
                .toLowerCase()
                .includes(game.playerNames[id].toLowerCase())
            ) {
              game.winner = id
            }
          }
        }
        if (line.startsWith("Summary ")) {
          const name = line.substring("Summary ".length, line.indexOf(":"))
          for (const playerId of allPlayerIds) {
            if (
              (game.playerNames[playerId]?.trim().toLowerCase() ?? "") ===
              name.trim().toLowerCase()
            ) {
              game.playerSummaries[playerId] = line.substring(
                line.indexOf(":") + 1
              )
            }
          }
        }
        if (line.startsWith("Response ")) {
          const name = line.substring("Response ".length, line.indexOf(":"))
          for (const playerId of allPlayerIds) {
            if (
              (game.playerNames[playerId]?.trim().toLowerCase() ?? "") ===
              name.trim().toLowerCase()
            ) {
              game.aiResponses[playerId] = line.substring(line.indexOf(":") + 1)
              game.responseIdsToShow.push(playerId)
            }
          }
          game.responseEndTime =
            Rune.gameTime() + PAUSE_PERIOD * game.responseIdsToShow.length
        }
      }
    },
  },
  actions: {
    ready: (_, { game, allPlayerIds, playerId }) => {
      if (!game.ready[playerId]) {
        game.ready[playerId] = true
        for (const id of allPlayerIds) {
          if (!game.ready[id]) {
            return
          }
        }

        game.questionEndTime = Rune.gameTime() + 1000
      }
    },
    next: (_, { game }) => {
      game.introDone = true

      // prompt for intro
      runPrompt(game, INTRO_PROMPT, "system")
      game.question = null
      game.playerAnswers = {}
      game.aiResponses = {}
    },
    answer: ({ answer, name }, { game, playerId, allPlayerIds }) => {
      game.playerAnswers[playerId] = answer
      game.playerNames[playerId] = name

      let answersPrompt = ""
      for (const playerId of allPlayerIds) {
        if (!game.playerAnswers[playerId]) {
          return
        }
        answersPrompt +=
          "Answer " +
          game.playerNames[playerId] +
          ": " +
          game.playerAnswers[playerId].replaceAll("\n", "") +
          "\n"
      }

      game.playerAnswersDone = true
      game.aiResponses = {}
      runPrompt(game, answersPrompt, "user")
    },
  },
})
