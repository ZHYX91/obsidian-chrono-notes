<%* const answer = await tp.system.prompt("Wait at least one second before confirming", "selected-template"); %>
# <% tp.file.title %>
selected=<% answer %>
kind=<% tp_calendar.kind %>
title=<% tp_calendar.title %>
target=<% tp_calendar.kind === "periodic" ? tp_calendar.targetDate : "range" %>
start=<% tp_calendar.startDate %>
end=<% tp_calendar.endDate %>
dayCount=<% tp_calendar.dayCount %>
