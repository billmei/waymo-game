/* Waymo Care · what the characters say, in the format of Slop Skies' radio (id: [speaker, text]). The block between
   the markers is plain JSON: tools/gen_voice.py reads it to record voice/<id>.mp3 for every line. Ids that share a
   prefix and end in a number (disp.good.1, disp.good.2, …) are variants the game picks between.
   Dispatch is a sarcastic, bratty young guy: snarky and smug, cheering you on in his own backhanded way.
   The riders are a cast of San Franciscans, each with their own voice: TOURIST (a wide-eyed dad from Ohio), INFLUENCER
   (vocal fry, every smudge a crisis), GRANDMA (sweet, a little confused), FOUNDER (late for standup), LOCAL (deadpan,
   seen it all), ARTIST (dreamy, from the Mission) and STUDENT (frazzled and sorry). */
(function () {
  "use strict";
  const WG = (window.WG = window.WG || {});
  WG.LINES = /*LINES*/ {
    "disp.start.lombard": ["DISPATCH", "Morning, crew! Steepest shift of the day, from Lombard's crooked bricks to Coit Tower. Keep those robotaxis rolling!"],
    "disp.start.presidio": ["DISPATCH", "Welcome to the Presidio! Golden Gate Bridge over the trees, the old Army post all round you. Let's roll!"],
    "disp.start.downtown": ["DISPATCH", "Lunch rush downtown! Between the Pyramid and Salesforce Tower, everybody's on the move."],
    "disp.start.ladies": ["DISPATCH", "Golden hour on Alamo Square! Everybody's taking pictures of the Painted Ladies. Go, go, go!"],
    "disp.start.windmills": ["DISPATCH", "Karl's rolling in over the windmills. I can't see a thing out there, so keep those cars running!"],
    "disp.call.dirty": ["DISPATCH", "One of ours took a mud bath. Grab the sponge!"],
    "disp.call.charge": ["DISPATCH", "Battery's running on two percent. Plug it in!"],
    "disp.call.cone": ["DISPATCH", "Somebody boxed a car in with cones. Clear the road!"],
    "disp.call.birds": ["DISPATCH", "Pigeons on the lidar! They think it's a heated seat!"],
    "disp.call.reboot": ["DISPATCH", "One of ours is having a moment. Turn it off and on again!"],
    "disp.call.vacuum": ["DISPATCH", "Popcorn all over the back seat! Was somebody watching a movie?"],
    "disp.call.doors": ["DISPATCH", "Riders left the doors open. Go bump them shut!"],
    "disp.good.1": ["DISPATCH", "Nice work!"],
    "disp.good.2": ["DISPATCH", "Spotless!"],
    "disp.good.3": ["DISPATCH", "Back on the road!"],
    "disp.good.4": ["DISPATCH", "That rider's smiling!"],
    "disp.good.5": ["DISPATCH", "Smooth!"],
    "disp.good.6": ["DISPATCH", "Five stars!"],
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
    "rider.dirty.1": ["TOURIST", "Is that a seagull's doing? On my window? I'm on vacation!"],
    "rider.dirty.2": ["TOURIST", "I can't see the Bay Bridge! I came all the way from Ohio!"],
    "rider.dirty.3": ["INFLUENCER", "I cannot take a selfie in a muddy car. I just can't."],
    "rider.charge.1": ["GRANDMA", "It says two percent, dear. Is that bad?"],
    "rider.charge.2": ["FOUNDER", "We stopped? I have a standup in four minutes!"],
    "rider.charge.3": ["LOCAL", "Two percent? Same, buddy. Same."],
    "rider.cone.1": ["ARTIST", "Cones! All the way around us! Is this an art piece?"],
    "rider.cone.2": ["LOCAL", "Coned in. Again. Classic San Francisco."],
    "rider.birds.1": ["ARTIST", "The pigeons won't let us leave! Do I tip them?"],
    "rider.birds.2": ["LOCAL", "There's a gull staring at me through the roof. He wants my fries."],
    "rider.reboot.1": ["GRANDMA", "The car says it can't see. Honestly? Me neither!"],
    "rider.reboot.2": ["FOUNDER", "Hello? Car? Are you okay in there? Blink twice!"],
    "rider.vacuum.1": ["GRANDMA", "Whose sock is this? Why is it warm?"],
    "rider.vacuum.2": ["INFLUENCER", "I am not sitting in that popcorn. I'm wearing linen!"],
    "rider.doors.1": ["STUDENT", "Oops! Did I leave the door open? All of them?"],
    "rider.doors.2": ["STUDENT", "Sorry! My hands were full of burritos!"]
  } /*END*/;
})();
