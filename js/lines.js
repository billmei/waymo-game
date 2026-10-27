/* Waymo Care · what the characters say, in the format of Slop Skies' radio (id: [speaker, text]). The block between
   the markers is plain JSON: tools/gen_voice.py reads it to record voice/<id>.mp3 for every line. Ids that share a
   prefix and end in a number (disp.good.1, disp.good.2, …) are variants the game picks between.
   Dispatch talks like Karl on Slop Skies' radio: bubbly, kind and a little cheeky, cheering you on and never scolding.
   The riders are a different San Franciscan every time: a tourist, a grandma, a founder late for standup, a jaded local. */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  WG.LINES = /*LINES*/ {
    "disp.start.downtown": ["DISPATCH", "Morning, crew! Downtown's waking up, and so are the robotaxis. Let's keep them happy!"],
    "disp.start.sunset": ["DISPATCH", "Karl the Fog's out in the Sunset today. Cozy for him, foggy sensors for us!"],
    "disp.start.mission": ["DISPATCH", "Golden hour in the Mission! Everybody's out, burritos in hand. Have fun!"],
    "disp.call.dirty": ["DISPATCH", "Ooh, a muddy one! Somebody went off-roading. Sponge time!"],
    "disp.call.charge": ["DISPATCH", "This one's on two percent and being very dramatic about it. Plug it in!"],
    "disp.call.cone": ["DISPATCH", "Somebody coned one of ours again. Go free the little guy!"],
    "disp.call.birds": ["DISPATCH", "Pigeons on the lidar! They think it's a heated seat!"],
    "disp.call.reboot": ["DISPATCH", "One of ours is having a moment. Turn it off and on again!"],
    "disp.call.vacuum": ["DISPATCH", "Popcorn all over the back seat! Was somebody watching a movie?"],
    "disp.call.doors": ["DISPATCH", "Doors left wide open! Grab your board and slam them shut!"],
    "disp.good.1": ["DISPATCH", "Nice!"],
    "disp.good.2": ["DISPATCH", "Sparkly! I can see my face in it!"],
    "disp.good.3": ["DISPATCH", "Back on the road! Bye-bye!"],
    "disp.good.4": ["DISPATCH", "That rider's smiling! Probably!"],
    "disp.good.5": ["DISPATCH", "Smooth! Very smooth!"],
    "disp.good.6": ["DISPATCH", "Five stars! No notes!"],
    "disp.good.7": ["DISPATCH", "Look at you go!"],
    "disp.perfect.1": ["DISPATCH", "Perfect! Not a second wasted!"],
    "disp.perfect.2": ["DISPATCH", "Textbook! I'm writing that one down!"],
    "disp.perfect.3": ["DISPATCH", "So fast! Are you secretly a robot too?"],
    "disp.combo.1": ["DISPATCH", "That's a streak! The whole fleet's honking for you!"],
    "disp.combo.2": ["DISPATCH", "On a roll! Don't get a big head!"],
    "disp.miss.1": ["DISPATCH", "Aw, that rider walked. It happens!"],
    "disp.miss.2": ["DISPATCH", "Oops, we lost that one. The next one's yours!"],
    "disp.miss.3": ["DISPATCH", "One got away. Shake it off!"],
    "disp.hurry": ["DISPATCH", "Twenty seconds left! Just a few more, you've got this!"],
    "disp.timeup": ["DISPATCH", "That's time! Come on back!"],
    "disp.result.good": ["DISPATCH", "Great shift! The riders are sending you heart emojis."],
    "disp.result.ok": ["DISPATCH", "Not bad at all! The next shift's gonna be even better."],
    "disp.final.platinum": ["DISPATCH", "Platinum! Best pit crew in the whole city! I'm telling everyone!"],
    "disp.final.gold": ["DISPATCH", "Gold! The fleet's never been this shiny!"],
    "disp.final.silver": ["DISPATCH", "Silver! A really solid day. I'm proud of you!"],
    "disp.final.bronze": ["DISPATCH", "Bronze! You kept the city moving. That counts!"],
    "disp.final.none": ["DISPATCH", "Rough day, huh? Grab a coffee. We'll get them next time!"],
    "rider.dirty.1": ["RIDER", "Is that a seagull's doing? On my window? I'm on vacation!"],
    "rider.dirty.2": ["RIDER", "I can't see the Bay Bridge! I came all the way from Ohio!"],
    "rider.dirty.3": ["RIDER", "I cannot take a selfie in a muddy car. I just can't."],
    "rider.charge.1": ["RIDER", "It says two percent, dear. Is that bad?"],
    "rider.charge.2": ["RIDER", "We stopped? I have a standup in four minutes!"],
    "rider.charge.3": ["RIDER", "Two percent? Same, buddy. Same."],
    "rider.cone.1": ["RIDER", "Cones! All the way around us! Is this an art piece?"],
    "rider.cone.2": ["RIDER", "Coned in. Again. Classic San Francisco."],
    "rider.birds.1": ["RIDER", "The pigeons won't let us leave! Do I tip them?"],
    "rider.birds.2": ["RIDER", "There's a gull staring at me through the roof. He wants my fries."],
    "rider.reboot.1": ["RIDER", "The car says it can't see. Honestly? Me neither!"],
    "rider.reboot.2": ["RIDER", "Hello? Car? Are you okay in there? Blink twice!"],
    "rider.vacuum.1": ["RIDER", "Whose sock is this? Why is it warm?"],
    "rider.vacuum.2": ["RIDER", "I am not sitting in that popcorn. I'm wearing linen!"],
    "rider.doors.1": ["RIDER", "Oops! Did I leave the door open? All of them?"],
    "rider.doors.2": ["RIDER", "Sorry! My hands were full of burritos!"]
  } /*END*/;
})();
