// Heartbeat for hidden tabs. Browsers freeze requestAnimationFrame and
// throttle main-thread timers when a tab is in the background, but worker
// timers keep firing — the game listens to these ticks and keeps stepping
// its simulation so both dimensions stay live and in sync.
setInterval(() => postMessage(0), 50)
