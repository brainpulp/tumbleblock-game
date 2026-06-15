(() => {
  const STORAGE_KEY = "tumbleblock-scores";
  const scores = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  let startedAt = performance.now();
  let lastResult = null;
  const timer = document.querySelector("#timer");
  const formatTime = milliseconds => { if (milliseconds == null) return "--"; const seconds = milliseconds / 1000; return seconds < 60 ? `${seconds.toFixed(1)}s` : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2,"0")}`; };
  function saveResult() {
    const elapsed = Math.max(1,Math.round(performance.now()-startedAt)); const previous=scores[levelIndex]||{};
    const moveRecord=previous.moves==null||moves<previous.moves; const timeRecord=previous.time==null||elapsed<previous.time;
    scores[levelIndex]={moves:previous.moves==null?moves:Math.min(previous.moves,moves),time:previous.time==null?elapsed:Math.min(previous.time,elapsed)};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(scores)); lastResult={levelIndex,moves,elapsed,moveRecord,timeRecord}; return lastResult;
  }
  function updateTimer(){timer.textContent=formatTime(lastResult?lastResult.elapsed:performance.now()-startedAt);}
  function renderScores(){const list=document.querySelector("#scores-list");list.innerHTML="";levels.forEach((level,index)=>{const score=scores[index],row=document.createElement("div");row.className="score-row";row.innerHTML=`<span>${index+1}</span><strong>${level.title}</strong><span>${score?`${score.moves} moves`:"--"}</span><span>${formatTime(score?.time)}</span>`;list.append(row);});}
  const baseLoadLevel=loadLevel;loadLevel=function(index){const result=baseLoadLevel(index);startedAt=performance.now();lastResult=null;updateTimer();return result;};
  const baseCompleteLevel=completeLevel;completeLevel=function(){const result=saveResult();const records=[result.moveRecord&&"best moves",result.timeRecord&&"best time"].filter(Boolean);const copy=`Solved in ${result.moves} moves and ${formatTime(result.elapsed)}${records.length?` - new ${records.join(" + ")}`:""}.`;ui.resultCopy.textContent=copy;const completed=baseCompleteLevel();setTimeout(()=>{ui.resultCopy.textContent=copy;},0);renderScores();return completed;};
  const baseBuildLevelGrid=buildLevelGrid;buildLevelGrid=function(){baseBuildLevelGrid();[...ui.levelGrid.querySelectorAll("button")].forEach((button,index)=>{const score=scores[index];if(!score)return;const summary=document.createElement("small");summary.className="level-score";summary.textContent=`${score.moves} / ${formatTime(score.time)}`;button.append(summary);});};
  document.querySelector("#scores").onclick=()=>{renderScores();document.querySelector("#scores-dialog").showModal();};
  document.querySelector("#close-scores").onclick=()=>document.querySelector("#scores-dialog").close();
  document.querySelector("#repeat-level").onclick=()=>loadLevel(levelIndex);
  document.querySelector("#share-result").onclick=async()=>{const result=lastResult;if(!result)return;const url=new URL(location.href);url.search="";url.searchParams.set("challenge",result.levelIndex+1);const text=`I solved Tumbleblock level ${result.levelIndex+1}, ${levels[result.levelIndex].title}, in ${result.moves} moves and ${formatTime(result.elapsed)}. Can you beat me?`;try{if(navigator.share)await navigator.share({title:"Tumbleblock Challenge",text,url:url.href});else{await navigator.clipboard.writeText(`${text} ${url.href}`);showMessage("Challenge copied");}}catch(error){if(error.name!=="AbortError")showMessage("Unable to share");}};
  const challenge=Number(new URLSearchParams(location.search).get("challenge"));if(challenge>=1&&challenge<=levels.length){unlocked=Math.max(unlocked,challenge-1);localStorage.setItem("tumbleblock-unlocked",unlocked);loadLevel(challenge-1);showMessage("Challenge loaded");}
  renderScores();updateTimer();setInterval(updateTimer,100);
})();
