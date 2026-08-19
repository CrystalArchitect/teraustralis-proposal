/* Sydney Station campus switcher. No telemetry. No live MW. */
(function () {
  "use strict";
  var west = document.getElementById("campus-west");
  var east = document.getElementById("campus-east");
  var tabs = document.querySelectorAll("[data-campus]");
  function show(name) {
    var isWest = name === "west";
    if (west) west.hidden = !isWest;
    if (east) east.hidden = isWest;
    tabs.forEach(function (btn) {
      var on = btn.getAttribute("data-campus") === name;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      show(btn.getAttribute("data-campus"));
    });
  });
})();
