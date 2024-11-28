import { PAUSE_PERIOD, QUESTION_PERIOD } from "./logic"
import "./styles.css"
import musicUrl from "./assets/music.mp3"

const music = new Audio()
music.src = musicUrl

music.loop = true
music.play()

function div(id: string): HTMLDivElement {
  return document.getElementById(id) as HTMLDivElement
}
function textarea(id: string): HTMLTextAreaElement {
  return document.getElementById(id) as HTMLTextAreaElement
}

div("doneButton").addEventListener("click", () => {
  div("doneButton").innerHTML = "READY!"
  textarea("playerInput").disabled = true
  Rune.actions.ready()
})

div("nextButton").addEventListener("click", () => {
  Rune.actions.next()
  music.play()
})

let currentScreen = "introScreen"
let sentAnswer = false

function showScreen(screen: string) {
  if (screen !== currentScreen) {
    div(currentScreen).classList.add("disabled")
    div(currentScreen).classList.remove("enabled")

    currentScreen = screen

    div(currentScreen).classList.remove("off")
    div(currentScreen).classList.remove("disabled")
    div(currentScreen).classList.add("enabled")
  }
}

Rune.initClient({
  onChange: ({ game, yourPlayerId, event }) => {
    if (event && event.name === "stateSync" && event.isNewGame) {
      showScreen("introScreen")
    }
    // if the responses have finished and we've got summaries then
    // we've finished the game
    if (
      (game.responseEndTime === 0 || Rune.gameTime() > game.responseEndTime) &&
      Object.keys(game.playerSummaries).length > 0
    ) {
      // end state
      div("decisionText").innerHTML = game.decisionText
      div("dateText").innerHTML = game.dateText

      let summaryText = "Now the big question, will it be: <br/><br/>"
      for (const playerId of Object.keys(game.playerSummaries)) {
        summaryText +=
          game.playerNames[playerId] +
          " - " +
          game.playerSummaries[playerId] +
          "<br/><br/>"
      }
      div("summaryText").innerHTML = summaryText

      if (Rune.gameTime() < game.showResultTime) {
        showScreen("summaryScreen")
      } else {
        showScreen("resultScreen")
      }
    } else {
      if (game.contestantIntroDone) {
        // reset of the game screens here
        if (game.playerAnswersDone) {
          // show answers once we have them
          if (Object.keys(game.aiResponses).length > 0) {
            showScreen("answerScreen")
          }
        } else {
          if (currentScreen !== "questionScreen") {
            textarea("playerInput").value = ""
            textarea("playerInput").disabled = false
            div("doneButton").innerHTML = "SUBMIT"
          }
          showScreen("questionScreen")
        }
      } else if (game.introDone && currentScreen !== "contestantIntroScreen") {
        showScreen("contestantIntroScreen")
      }

      if (currentScreen === "answerScreen" && yourPlayerId) {
        const totalTime = PAUSE_PERIOD * game.responseIdsToShow.length
        const timeSoFar = totalTime - (game.responseEndTime - Rune.gameTime())

        if (timeSoFar < totalTime) {
          const index = Math.floor(timeSoFar / PAUSE_PERIOD)
          const currentPlayerId = game.responseIdsToShow[index]

          ;(
            document.getElementById("playerAvatarImage") as HTMLImageElement
          ).src = Rune.getPlayerInfo(currentPlayerId).avatarUrl

          div("playerNameText").innerHTML =
            Rune.getPlayerInfo(currentPlayerId).displayName
          div("answerText").innerHTML = game.playerAnswers[currentPlayerId]

          if (timeSoFar / PAUSE_PERIOD - index > 0.5) {
            div("computerResponse").style.display = "block"
            div("computerAvatar").style.display = "block"
            div("responseText").innerHTML = game.aiResponses[currentPlayerId]
          } else {
            div("computerResponse").style.display = "none"
            div("computerAvatar").style.display = "none"
          }
        }
      }
      if (currentScreen === "questionScreen" && yourPlayerId) {
        const timeRemaining = game.questionEndTime - Rune.gameTime()
        if (timeRemaining <= QUESTION_PERIOD / 10 && game.questionEndTime > 0) {
          div("timerBar").style.width = "0%"
          showScreen("thinkingScreen")
          let answer = textarea("playerInput").value
          if (answer.trim() === "") {
            answer = "I've no idea!"
          }
          if (!sentAnswer) {
            sentAnswer = true
            setTimeout(() => {
              Rune.actions.answer({
                name: Rune.getPlayerInfo(yourPlayerId).displayName,
                answer,
              })
            }, 1)
          }
        } else {
          sentAnswer = false
          const percent = (timeRemaining / QUESTION_PERIOD) * 100 + "%"
          div("timerBar").style.width = percent
        }
      }
      div("contestantIntroText").innerHTML = game.introText
      div("questionText").innerHTML = game.question ?? ""
    }
  },
})
