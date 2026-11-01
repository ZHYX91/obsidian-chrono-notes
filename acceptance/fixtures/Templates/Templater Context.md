# <% tp.file.title %>
kind=<% tp_calendar.kind %>
title=<% tp_calendar.title %>
target=<% tp_calendar.kind === "periodic" ? tp_calendar.targetDate : "range" %>
start=<% tp_calendar.startDate %>
end=<% tp_calendar.endDate %>
dayCount=<% tp_calendar.dayCount %>
time=<% tp_calendar.time("HH:mm:ss") %>
timeDecade=<% tp_calendar.time("DEC[s]") %>
timeCentury=<% tp_calendar.time("[C]CEN") %>
