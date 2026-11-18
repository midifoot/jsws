# JSWS AUTOBAND 
Javascript WebSequencer (as a PWA) for generating predictive and generative drums/bass/chords : 

# AutoBand — Complete User Guide & Parameter Reference Cheatsheet

> **Document Purpose:** Practical reference guide and live-performance cheatsheet explaining how **AutoBand** works, how every mode and parameter alters the baseline ("normal") behavior of the sequencer, and how to combine **Polymetric Sync**, **Humanize**, **Predictive Tension (`-5` to `+5`)**, **Get Inspired (`GENERATE 🎲`)**, and the **9-Mode Harmonic Voyager (`VOYAGE 🧭`)**.

---

## Table of Contents
1. [System Overview & Audio/MIDI Architecture](#1-system-overview--audiomidi-architecture)
2. [Quick-Start Checklist (First Launch)](#2-quick-start-checklist-first-launch)
3. [View 1: Main Stage — Transport, Teleprompter & Loop Chains](#3-view-1-main-stage--transport-teleprompter--loop-chains)
4. [Time-Signature Sync Modes & Tempo Ratios (Polyrhythm vs. Polymeter)](#4-time-signature-sync-modes--tempo-ratios-polyrhythm-vs-polymeter)
5. [Predictive Tension Engine (`-5` to `+5`) — Complete Behavior Matrix](#5-predictive-tension-engine--5-to-5--complete-behavior-matrix)
6. [9-Mode Harmonic Voyager & Pivot Modulation (`VOYAGE 🧭`)](#6-9-mode-harmonic-voyager--pivot-modulation-voyage-)
7. [Humanize Engine (Micro-Timing & Velocity Jitter)](#7-humanize-engine-micro-timing--velocity-jitter)
8. [View 2: Pattern Library & Specialized Editors (Drums, Bass, Chords)](#8-view-2-pattern-library--specialized-editors-drums-bass-chords)
9. [Algorithmic Pattern Generator ("Get Inspired" `GENERATE 🎲`)](#9-algorithmic-pattern-generator-get-inspired-generate-)
10. [Chord Dictionary & Voicing Explorer (`🎹 CHORDS DICTIONARY`)](#10-chord-dictionary--voicing-explorer--chords-dictionary)
11. [Offline Audio Export (`.WAV` & `.MP3` Bounce)](#11-offline-audio-export-wav--mp3-bounce)
12. [View 3: System Settings — Global Fine-Tuning Reference](#12-view-3-system-settings--global-fine-tuning-reference)
13. [Mouse, Drag & Keyboard Shortcuts Cheatsheet](#13-mouse-drag--keyboard-shortcuts-cheatsheet)

---

## 1. System Overview & Audio/MIDI Architecture

**AutoBand** is an offline-capable Progressive Web App (PWA) generative trio workstation consisting of three synchronized musical modules:

| Track / Module | MIDI Channel | Default GM SoundFont Preset | Role in the Trio |
| :--- | :---: | :--- | :--- |
| **A — DRUMS (`rhythm`)** | **Ch 10** (Bank 128) | `Jazz Kit (32)` | Master Bar Clock, 10-slot drum matrix, 4-state velocity (Off / Normal / Accent / Ghost) |
| **B — BASS (`bass`)** | **Ch 2** (Bank 0) | `Fingered Bass (33)` | Dual-mode sequencer (**Harmonic Follower** tracking live chords, or **Strict Pitch**) |
| **C — CHORDS (`chords`)** | **Ch 3** (Bank 0) | `Rhodes EP 1 (4)` | Multi-bar harmonic progression engine, 4 voicing spreads, Stage Teleprompter & Modal Voyager |

### Audio & MIDI Routing Hierarchy
* **Internal SoundFont2 Engine (`FluidR3_GM.sf2`):** Loaded once in **System Settings** and cached permanently in your browser's **IndexedDB** (`AutoBand_Audio_DB`). Runs through a 3-bus submixer (`Drums`, `Bass`, `Chords`) feeding a **Brickwall Dynamics Limiter** (`-3.0 dBFS`, `12:1` ratio) to prevent digital clipping.
=> the file can be found in the "src/vendor" folder for one time load 
or [here](https://sourceforge.net/projects/pianobooster/files/pianobooster/1.0.0/FluidR3_GM.sf2/download)
* **Web MIDI Hardware Output:** Any track can be routed independently to an external hardware synth, DAW, or virtual MIDI port (e.g., macOS IAC Driver or Windows loopMIDI) in **System Settings**.
* **Fallback Web Audio Synth:** If no `.sf2` file is cached and no external MIDI port is selected, AutoBand automatically synthesizes drums, bass, and chords using zero-click Web Audio oscillators so the app always produces sound immediately.

---

## 2. Install & Quick-Start Checklist (First Launch)

1. **Install prerequisites** : go to [main PWA url](https://midifoot.github.io/jsws/) and either use it online or download it as a PWA
2. **Load Your SoundFont (One-Time Setup):**
  * You must download `FluidR3_GM.sf2` [here](https://sourceforge.net/projects/pianobooster/files/pianobooster/1.0.0/FluidR3_GM.sf2/download) or use any other General Midi capable soundfont
3. **load soudnfont into the app cache**
   * Open **3. SYSTEM SETTINGS** $\rightarrow$ click **`Load Local .sf2`** and select it (it is now cached so it won't be needed again)
   * Once the top status pill turns green (`SF2: FluidR3_GM Ready`), the binary is stored in IndexedDB and will load automatically on every future session (even offline).
4. **Audition Your Sounds:**
   * On **1. MAIN STAGE**, use each track's **Preset Dropdown** and click the **`Test`** button right beside it to audition the GM instrument.
5. **Start Playback:**
   * Click **`▶ START`** (or press `Spacebar`). If **Pre-Count** is set to `1 Bar` or `2 Bars`, you will hear a rimshot count-in with a negative countdown timer before Bar 1 begins.

---

## 3. View 1: Main Stage — Transport, Teleprompter & Loop Chains

### A. Master Transport & Stage Snapshot Manager
* **Master Tempo (`40–240 BPM`):** Controls the global tempo for all patterns that have **`Sync with Master`** enabled.
* **Pre-Count (`Off`, `1 Bar`, `2 Bars`):** Plays a metronome count-in before the loop chain starts on Bar 1.
* **Metronome Toggle (`Metro ON/OFF`):** Keeps the quarter-note rimshot click audible during playback.
* **Stage Snapshots (`SAVE SNAPSHOT` / Recall Dropdown):** Captures the current Master Tempo, all three tracks' Loop Chain slot assignments, per-slot Tension values (`-5..+5`), Track Humanize overrides, and the 10-slot Drum Kit mapping.

### B. Harmonic Stage Teleprompter ("Now & Next" — 3m Readability)
* **NOW Panel (Left):** Displays the current Bar number, Beat counter, active **Tension** level (if non-zero), active **Modal Voyager** annotation (`🧭 ...`), and highlights the currently sounding chord inside the bar.
* **NEXT BAR Panel (Right):** Previews the upcoming bar's chords (including any live Tension or Modal Voyager substitutions) so you can anticipate changes before the barline arrives.
* **Silent Chord Slots (`Ø`):** Any chord slot left empty or set to `O` / `Ø` displays as `Ø` on the teleprompter, silences the Chords module for that slot, and also silences the Bass module when Bass is in **Harmonic Follower** mode.

### C. Loop Track Headers (Drums, Bass, Chords)
Each track row on the Main Stage includes:
1. **GM Preset Selector + `Test` Button:** Changes the SoundFont instrument in real time.
2. **`LVL` Slider (`0–100%`):** Track submix volume.
3. **`HUMAN` Slider (`0–100%`):**
   * **`0%` (Default):** Uses each individual pattern's own saved `HUMAN %` value.
   * **`> 0%` (Override):** Overrides all patterns on that track with the track's `HUMAN %` value in real time.
4. **`🧭 VOYAGE` Controls (Chords Track Header Only):** Controls real-time intermodal borrowing and pivot key modulations (detailed in [Section 6](#6-9-mode-harmonic-voyager--pivot-modulation-voyage-)).
5. **`M` (Mute) & `S` (Solo):** Instant rehearsal/performance track muting and soloing.
6. **`Loop Size` Stepper (`1–12` Slots):** Sets how many pattern slots are chained in sequence for that track. Since each track has its own independent `Loop Size`, you can chain e.g. a **2-slot Drum loop** against a **4-slot Chord loop** and a **3-slot Bass loop**!

---

## 4. Time-Signature Sync Modes & Tempo Ratios (Polyrhythm vs. Polymeter)

When you mix different time signatures across tracks (e.g., **Drums in `4/4`** while **Bass or Chords are in `7/8` or `6/8`**), AutoBand's behavior is governed by two settings:

### A. Global Time-Signature Sync Mode (Configured in System Settings or via the `Sync:` Pill)

| Sync Mode | How It Alters Playback When Time Signatures Differ | Best Musical Use Case |
| :--- | :--- | :--- |
| **1. Auto Bar-Fit (Polyrhythm)** | **Locks all barlines together.** Bass and Chords bars are automatically time-stretched or compressed so 1 bar of `6/8` or `7/8` finishes in the exact same wall-clock time as 1 bar of Master (`Drums`). | Classic **3-against-4** or **7-against-4** cross-rhythms where every track always lands on Beat 1 of the next bar together. |
| **2. Independent Clocks (Polymetric)** *(Default)* | **Locks the underlying note pulse.** Every track runs at its own true meter length (e.g., a `7/8` bar is `3.5` quarter notes long against a `4/4` bar of `4.0` quarter notes). Track barlines phase across each other over multiple bars. | King Crimson / Meshuggah / Steve Reich style **polymetric phasing** where patterns cycle and realign over longer phrases. |
| **3. Master Bar Reset (Truncate)** | Bass and Chords run at their native speed, but **hard-reset to Beat 1** every time the **Drums (Master)** track starts a new bar. | Keeping an odd-meter riff locked to the Master downbeat every single measure without time-stretching its internal groove. |

### B. Per-Pattern Tempo Ratio (`Tempo Ratio` in Pattern Editors)
Even when `Sync with Master` is checked, any pattern can apply a proportional **Tempo Ratio** relative to Master BPM:

| Tempo Ratio | Multiplier | Musical Effect |
| :---: | :---: | :--- |
| **`1:1`** | `1.00×` | **Normal behaviour:** 1 pattern quarter-note = 1 Master quarter-note. |
| **`3:2`** | `1.50×` | **Triplet Feel (`6/8` $\rightarrow$ `4/4`):** Fits 3 eighth-note pairs into 2 Master beats. |
| **`3:4`** | `0.75×` | **Bar-Fit (`6/8` $\rightarrow$ `4/4`):** Stretches 3 beats across 4 Master beats. |
| **`4:3`** | `1.33×` | **4-over-3 Cross-Rhythm:** Fits a `4/4` bar into a `3/4` Master bar. |
| **`1:2`** | `0.50×` | **Half-Time Feel:** Plays at half the Master tempo while staying beat-locked. |
| **`2:1`** | `2.00×` | **Double-Time Feel:** Plays at twice the Master tempo. |
| **`5:4` / `7:4`** | `1.25×` / `1.75×` | **Quintuplet / Septuplet Polyrhythm:** Fits 5 or 7 pulses into 4 Master beats. |

---

## 5. Predictive Tension Engine (`-5` to `+5`) — Complete Behavior Matrix

Every slot in the Main Stage Loop Chains has a **Tension Stepper (`-5` to `+5`, default `0`)** directly underneath the slot box.
* **Non-Destructive:** Tension modifies playback **on the fly** without ever overwriting your saved patterns.
* **Predictive Lookahead ($\Delta T = T_{\text{next}} - T_{\text{now}}$):** On the **final beat of every bar**, the engine peeks at the *next* slot's Tension value in the chain:
  * If Tension is **rising** ($\Delta T \ge +2$, e.g. `0` $\rightarrow$ `+3`), the band automatically plays a **setup pickup** (drum snare/tom fill, bass chromatic approach, chord anticipation stab) on the last beat of the current bar!
  * If Tension is **dropping sharply** ($\Delta T \le -2$, e.g. `+4` $\rightarrow$ `-2`), Drums and Bass insert a **dramatic 16th-note "drop breath"** right before the barline so the low-tension breakdown hits with maximum impact.

### How Each Module Reacts to Slot Tension (`-5` to `+5`)

| Tension Level | 🥁 DRUMS Behavior | 🎸 BASS Behavior | 🎹 CHORDS & Teleprompter Behavior |
| :---: | :--- | :--- | :--- |
| **`-5` to `-3`**<br>*(Deep Breakdown / Space)* | • **Suppresses** all ghost notes (State `3`).<br>• Mutes auxiliary percussion (`Toms`, `Ride`, `Clap`, `Shaker`, `Cowbell`).<br>• Thins 16th hi-hats down to 8ths or quarter notes.<br>• Keeps only the core Downbeat Kick & primary Backbeat Snare.<br>• Softens velocities by **`-15%` to `-25%`**. | • **Foundation Pedal Mode:** Silences busy off-beat 8th/16th steps.<br>• Plays primarily on **Beat 1** (Root `R` with long `90–100%` legato gate) and optionally the half-bar pulse (`5`).<br>• Simplifies all tensions (`b2`, `b5`, `7`) to pure `R` or `5`.<br>• Softens velocity. | • **Pure Triad Simplification:** Strips upper extensions and alterations down to pure triads (`Cmaj9` $\rightarrow$ `C`, `Dm11` $\rightarrow$ `Dm`, `G13` $\rightarrow$ `G`).<br>• At **`-5`**, sustains the first chord across the entire bar.<br>• Softens velocity (`-15%`). |
| **`-2` to `-1`**<br>*(Laid-Back / Intimate)* | • Drops `50–80%` of ghost notes and secondary percussion.<br>• Keeps main Kick, Snare, and 8th-note Hi-Hat pocket intact.<br>• Softens velocities by **`-5%` to `-10%`**. | • Drops off-beat 16th syncopations.<br>• Simplifies chromatic/upper degrees (`b2`, `b5`, `6`, `7`) into consonant `R`, `5`, or `-5`. | • **Clean 7ths:** Removes sharp/flat alterations while keeping smooth 7th harmony (`G7b9` $\rightarrow$ `G7`, `Cmaj7#11` $\rightarrow$ `Cmaj7`). |
| **`0`**<br>*(Normal / Written)* | **Plays 100% as written** in the Drum Lab Editor. | **Plays 100% as written** in the Bassline Editor. | **Plays 100% as written** in the Chord Editor. |
| **`+1` to `+2`**<br>*(Groove Lift & Color)* | • Lifts existing ghost-note velocity (`+6` to `+13` MIDI vel).<br>• Injects subtle **snare ghost notes** on empty off-beat 16ths (`15–35%` prob).<br>• Adds occasional kick pickup before the backbeat and subtle shaker (`PERC 2`) drive at `+2`. | • Awakens selected **Rest (`R`)** steps on upbeat 8ths/16ths with chord tones (`3`, `5`, `b7`, `R8`).<br>• On the final beat of the bar (at `+2`), injects a **half-step or fifth approach note** leading into the next chord. | • **Rich Extensions (Same Root):** Upgrades triads and 7ths to lush 9ths, 11ths, and 13ths (`Cmaj7` $\rightarrow$ `Cmaj9` or `C6/9`, `Am7` $\rightarrow$ `Am9`/`Am11`, `G7` $\rightarrow$ `G9`/`G13`). |
| **`+3` to `+5`**<br>*(Climax / Tritone Subs / Fills)* | • High ghost-note chatter + upgrades backbeat snares to **Accents (`127`)**.<br>• Adds Open Hi-Hat (`OH`) barks at bar endings and active shaker/hat subdivisions.<br>• **Final Beat Turnaround Fill:** Generates a dynamic **High Tom $\rightarrow$ Low Tom $\rightarrow$ Snare** turnaround fill on the last beat of the bar! | • High-energy syncopation + injects accented **Octave Pops (`R8`)** with `25% Stac` gate and `/` Slides.<br>• **Chromatic Lead-In:** On the final beat of the bar, targets **`±1` semitone** below/above the upcoming chord's root for an authentic jazz/funk walk-in! | • **Modal & Tritone Substitution Matrix:**<br>  – **Dominants:** Upgrade to Altered (`7b9`, `7#9`, `7#5`) and at **`≥ +3`** perform **Tritone Substitutions** (`G7` $\rightarrow$ `Db9` / `Db7#9`).<br>  – **Majors:** Borrow **Lydian `maj7#11`** or `maj13`.<br>  – **Minors:** Upgrade to `m11` or `mMaj7`.<br>  – **Rhythmic Comping:** Splits long chord slots into syncopated 2-hit comping stabs! |

> **Stage Teleprompter & Bass Sync Note:** Whenever Chords are substituted by Tension (e.g., `G7` $\rightarrow$ `Db7#9`), the **Stage Teleprompter** immediately displays the substituted chord (underlined with a dotted purple line and tooltip showing the original chord), and **Bass (in Harmonic Follower mode)** automatically tracks the new substituted root (`Db`)!

---

## 6. 9-Mode Harmonic Voyager & Pivot Modulation (`VOYAGE 🧭`)

Based on the **9-Mode × 7-Degree Harmonic Matrix** (`Ionian`, `Dorian`, `Phrygian`, `Lydian`, `Mixolydian`, `Aeolian`, `Locrian`, `Harmonic Minor`, `Melodic Minor`), the **Harmonic Voyager** allows your chord progressions to embark on controlled intermodal borrowings and key modulations.

### A. Reference Table: The 9-Mode × 7-Degree Matrix (Shown in Key of C)

| Mode | I | II | III | IV | V | VI | VII | Orbit Tier |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Ionian (Major)** | `Cmaj7` | `Dm7` | `Em7` | `Fmaj7` | `G7` | `Am7` | `Bm7b5` | **Near (Tier 1)** |
| **2. Dorian** | `Cm7` | `Dm7` | `Ebmaj7` | `F7` | `Gm7` | `Am7b5` | `Bbmaj7` | **Near (Tier 1)** |
| **3. Lydian** | `Cmaj7` | `D7` | `Em7` | `F#m7b5` | `Gmaj7` | `Am7` | `Bm7` | **Near (Tier 1)** |
| **4. Mixolydian** | `C7` | `Dm7` | `Em7b5` | `Fmaj7` | `Gm7` | `Am7` | `Bbmaj7` | **Near (Tier 1)** |
| **5. Aeolian (Nat. Min)** | `Cm7` | `Dm7b5` | `Ebmaj7` | `Fm7` | `Gm7` | `Abmaj7` | `Bb7` | **Near (Tier 1)** |
| **6. Phrygian** | `Cm7` | `Dbmaj7` | `Eb7` | `Fm7` | `Gm7b5` | `Abmaj7` | `Bbm7` | **Medium (Tier 2)** |
| **7. Melodic Minor** | `CmMaj7` | `Dm7` | `Ebmaj7#5` | `F7` | `G7` | `Am7b5` | `Bm7b5` | **Medium (Tier 2)** |
| **8. Harmonic Minor** | `CmMaj7` | `Dm7b5` | `Ebmaj7#5` | `Fm7` | `G7b9` | `Abmaj7` | `Bdim7` | **Medium (Tier 2)** |
| **9. Locrian** | `Cm7b5` | `Dbmaj7` | `Ebm7` | `Fm7` | `Gbmaj7` | `Ab7` | `Bbm7` | **Far (Tier 3)** |

### B. How the 4 Voyage Methods Work

| Voyage Method | Musical Mechanism | Example Starting from `Dm7` (`II` in C Ionian) |
| :--- | :--- | :--- |
| **1. `Parallel Modal`** *(Same Key)* | Keeps the Home Key (`C`) fixed and substitutes the chord with the **same degree** borrowed from another mode in the table. | Degree `II` in `C` borrows **`Dbmaj7`** (`C Phrygian II` / `C Locrian II`), **`Dm7b5`** (`C Aeolian II`), or **`D7`** (`C Lydian II`). |
| **2. `Pivot Modulation`** *(New Key & Mode)* | Re-interprets the current chord as a degree inside a **new Key & Mode** and resolves to a characteristic chord of that new key/mode! | `Dm7` (`-7`) is re-interpreted as **`IV` in A Locrian** (or `VI` in F Lydian, `III` in Bb Ionian) $\rightarrow$ steps to **`Fmaj7` / `Gbmaj7` / `Bm7b5`** in the new key! |
| **3. `Constant Structure`** *(Same Quality)* | Replaces the chord with another chord of the **exact same quality family** (`-7` $\rightarrow$ `-7`, `M7` $\rightarrow$ `M7`) from another degree/mode. | `Dm7` (`-7`) shifts to **`Fm7`** (`C Locrian IV`), **`Ebm7`** (`C Locrian III`), or **`Bbm7`** (`C Phrygian VII`). |
| **4. `Hybrid Blend`** *(Default)* | Smoothly alternates between **Parallel Modal**, **Pivot Modulation**, and **Constant Structure** across slots for an organic jazz/fusion voyage. | Combines all three mechanisms above automatically. |

### C. Voyage Orbit & Return-Home Gravity Controls
* **Orbit Selector (on Main Stage Chords Header & Chord Editor):**
  * **`Off (Written)`:** Disables modal extrapolation.
  * **`Tension-Linked`:** Links the Voyage Orbit to each Chord slot's Tension badge (`Tension ≤ 0` = Off, `+1..+2` = Near Orbit, `+3..+4` = Medium Orbit, `+5` = Far / Locrian).
  * **`Near Orbit`:** Uses Tier 1 modes (`Ionian`, `Dorian`, `Lydian`, `Mixolydian`, `Aeolian`) and closely related keys (`±1–2` fifths).
  * **`Medium Orbit`:** Adds Tier 2 modes (`Phrygian`, `Melodic Minor`, `Harmonic Minor`) and `±4` fifths key pivots.
  * **`Far / Locrian`:** Unlocks all 9 modes including **Locrian** and distant tritone/chromatic mediant key centers.
* **`🏠 Return Home` Gravity Toggle:**
  * **When `ON` (Default):** Always keeps the **first slot of Bar 1** anchored in your original Home Key so the listener never loses the tonic reference, and turns the **very last chord slot of the loop** into a magnetic turnaround (`V7b9`, `Phrygian bIImaj7`, `Aeolian ivm7`, or `Backdoor bVII7`) that resolves smoothly back to Bar 1.
  * **When `OFF`:** Allows Bar 1 and the final bar to modulate freely without returning home.

---

## 7. Humanize Engine (Micro-Timing & Velocity Jitter)

Eliminates robotic quantization without accumulating timing drift over long sessions.
* **Where to Set It:**
  * **Per-Pattern (`HUMAN %` `0–100%`):** Saved inside each Drum, Bass, or Chord pattern in its Pattern Editor.
  * **Per-Track Override (`HUMAN` Slider `0–100%` on Main Stage):** When set above `0%`, overrides the pattern's saved `HUMAN %` in real time.
* **Mathematical Formula (Applied Per Note Strike):**
  * **Micro-Timing Shift:**
    $$\Delta t = (\text{random}() - 0.5) \times W_{\max} \times \left(\frac{\text{Humanize \%}}{100}\right)$$
  * **Velocity Jitter:**
    $$\Delta v = \text{round}\left((\text{random}() - 0.5) \times V_{\max} \times \left(\frac{\text{Humanize \%}}{100}\right)\right)$$
* **Global Sensitivity Scaling (in `SYSTEM SETTINGS`):**
  * **Max Micro-Timing Window ($W_{\max}$):** Adjustable from `4 ms` to `80 ms` (Default: `24 ms` = `±12 ms` at 100%).
  * **Max Velocity Jitter Span ($V_{\max}$):** Adjustable from `4 vel` to `80 vel` (Default: `30 vel` = `±15 MIDI units` at 100%).

---

## 8. View 2: Pattern Library & Specialized Editors (Drums, Bass, Chords)

### A. Unified Pattern Library (`2. PATTERNS`)
* **Search & Filter Chips (`All`, `Drums`, `Bass`, `Chords`):** Quickly locate any pattern by ID (`D-01`, `B-02`, `C-01`) or name.
* **Inline Rename:** Click any pattern's name directly in the library table to rename it (up to 12 characters).
* **Portable Workspace Backup (`⬇ EXPORT (.json)` / `⬆ IMPORT (.json)`):** Saves or restores your entire library of patterns, custom chords, snapshots, and stage setups to a single `.json` file.

### B. Drum Lab Editor (`#editor-drums`)
* **Time Signature (`1–21` over `/4` or `/8`) & Step Resolution (`1/8`, `1/8T`, `1/16`, `1/32`):**
  * Automatically calculates the exact number of grid slots per bar (e.g., `7/8 @ 1/8` = `7` slots/bar; `4/4 @ 1/8T` = `12` triplet slots/bar; `4/4 @ 1/16` = `16` slots/bar).
* **Visual Beat Separator (`Beat Sep 1–9`):** Moves the vertical amber grouping lines to match your rhythmic subdivision (e.g., `Every 3` for ternary/compound meters, `Every 4` for 16ths).
* **4-State Step Cycle (Click any cell in the 10-row matrix):**
  1. **Off (`0`):** Silent.
  2. **Normal Hit (`1` — Green):** Standard strike (Default MIDI Velocity `90`).
  3. **Hi / Accent (`2` — White Glow):** Accented strike (Default MIDI Velocity `127`).
  4. **Ghost Note (`3` — Amber):** Subtle grace/ghost strike (Default MIDI Velocity `25`).
* **Row Mute (`M`) & Solo (`S`):** Mutes or solos individual drum instruments. **Important:** Muting a row (`M`) also **locks/protects** that row when clicking **`GENERATE 🎲`**!

### C. Bassline Editor (`#editor-bass`)
* **Pitch Mode Toggle (`HARMONIC FOLLOWER` vs. `STRICT PITCH`):**
  * **`HARMONIC FOLLOWER` (Default):** Each step stores a scale degree (`R`, `b2`, `2`, `b3`, `3`, `4`, `b5`, `5`, `b6`, `6`, `b7`, `7`, `R8`, or lower `-5`, `-b6`, `-6`, `-b7`, `-7`) that automatically transposes in real time to match whatever chord is playing on the Chords track!
  * **`STRICT PITCH`:** Plays fixed MIDI pitches (`C1` to `G3`) regardless of the active chord.
* **Octave Selector (`-4 Oct` to `+4 Oct`):** Shifts the entire bass pattern up or down by octaves in real time.
* **Interactive Step Cards:**
  * **Pitch/Degree Pill (`↕`):** Click to audition, **drag vertically up/down**, or **scroll the mouse wheel** to slide chromatically through degrees or pitches.
  * **Gate Bar (`25% Stac` / `50% Std` / `100% Leg`):** Click to cycle note duration between staccato, standard, and legato.
  * **Articulation Buttons:** **`>` (Accent)** boosts velocity to `120`; **`/` (Slide)** extends legato overlap; **`R` (Rest)** silences the step.
* **`MUTE BASS` Rehearsal Button:** Quickly mutes the Bass track so a live bassist can practice along with Drums and Chords.

### D. Chord Sequence Editor (`#editor-chords`)
* **Bars (`1–8`) & Per-Bar Harmonic Resolution (`1/1`, `1/2`, `1/3`, `1/4`):**
  * Every measure card has its own **`1/1 (1)`**, **`1/2 (2)`**, **`1/3 (3)`**, and **`1/4 (4)`** buttons in its header, allowing you to put e.g. **1 chord in Bar 1**, **2 chords in Bar 2**, and **4 chords in Bar 4**.
* **Voicing Style Spread:**
  * **`Jazz Drop-2 (Open)`:** Drops the second-highest voice down an octave for a warm, open jazz keyboard spread.
  * **`Pop Triads (Close)`:** Tight, root-position studio keyboard voicing.
  * **`Quartal Open (4ths)`:** McCoy Tyner / modal fourth-stacked voicings.
  * **`Lush Pad (2-Hand Wide)`:** Deep bass root (`-12` semitones) + inner harmony + shimmering upper 10th.
* **Octave Selector (`-4 Oct` to `+4 Oct`):** Shifts the keyboard register across 8 octaves.
* **Silence Toggle (`Ø`):** Clicking `Ø` on any chord slot (or typing `O` / leaving it blank) turns that slot into a **Rest / N.C.** (`SILENCE`).

---

## 9. Algorithmic Pattern Generator ("Get Inspired" `GENERATE 🎲`)

Located in the top toolbar of all three Pattern Editors:

| Editor | Available `Style` Templates | What `RAND %` (`0–100%`) Controls | Special Rules |
| :--- | :--- | :--- | :--- |
| **Drums** | • `Funk / Groove`<br>• `Jazz / Swing`<br>• `Rock / Straight`<br>• `Electronic / 808`<br>• `Latin / Odd-Pocket` | • **`0–30%`:** Strict genre pocket.<br>• **`40–70%`:** Adds snare ghost notes, open-hat barks & syncopated kicks.<br>• **`80–100%`:** Polyrhythmic cross-accents, active percussion & turnaround tom fills. | **Muted Rows (`M`) are Protected:** Mute your Kick or Snare row to keep it intact while regenerating Hi-Hats and Percussion around it! |
| **Bass** | • `Walking Bass`<br>• `Slap / Funk`<br>• `Synth / Arp`<br>• `Root-Fifth Pocket` | • **`0–30%`:** Consonant chord tones (`R`, `3`, `5`, `R8`).<br>• **`40–70%`:** Passing tones (`2`, `6`, `b7`), `/` slides & staccato pockets.<br>• **`80–100%`:** Chromatic approaches (`-7`, `b2`, `b5`) & wide octave leaps. | Simultaneously populates both **`HARMONIC FOLLOWER`** degrees and **`STRICT PITCH`** notes so you can switch modes freely. |
| **Chords** | • `Jazz ii-V-I & Turnarounds`<br>• `Pop / Neo-Soul Changes`<br>• `Modal Vamp (Dorian/Lydian)`<br>• `Blues / Gospel Changes` | • **`0–30%`:** Clean diatonic 7ths & triads.<br>• **`40–70%`:** Lush 9ths, 11ths, 13ths & secondary dominants.<br>• **`80–100%`:** Altered dominants (`7b9`, `7#9`), `maj7#11`, and tritone substitutions. | **Preserves Chords/Bar Format:** Strictly respects how many chord slots (`1..4`) you configured in each individual bar, and transposes into your chosen **Key (`Auto` or `C..B`)**. |

> **Chord Editor `VOYAGE 🧭` vs. `GENERATE 🎲`:**
> * Click **`GENERATE 🎲`** when you want to create a **brand-new progression** from scratch in a chosen style and key.
> * Click **`VOYAGE 🧭`** when you already have a progression you like and want to **interpolate / modulate** its existing chords through the 9-Mode Matrix (and inspect the `🧭` modal origin notes on each card).

---

## 10. Chord Dictionary & Voicing Explorer (`🎹 CHORDS DICTIONARY`)

Accessible from the Main Navigation Bar or inside the Chord Editor:
* **63 Built-In Chords Across 6 Categories:** `Major`, `Minor`, `Dominant`, `Suspended & Add`, `Diminished & Augmented`, and `Slash / Polychords`.
* **Interactive 3-Octave SVG Keyboard (`C3–B5`):** Highlights the Root (Amber), Chord Tones (Green), and Voiced Notes across all 12 Root keys (`C` to `B`) and all 4 Voicing Styles (`Pop Triads`, `Jazz Drop-2`, `Quartal Open`, `Lush Pad`).
* **`🔊 AUDITION CHORD`:** Plays the exact voiced chord through your active SoundFont/MIDI engine.
* **`+ CREATE / EDIT CUSTOM CHORD`:** Lets you define custom chord suffixes by clicking semitone intervals (`0–24`) and saves them permanently to `localStorage`.

---

## 11. Offline Audio Export (`.WAV` & `.MP3` Bounce)

Click **`EXPORT AUDIO 💾`** on the **Main Stage** (full trio arrangement bounce) or inside any **Pattern Editor** (individual stem bounce):
* **Background Rendering (`OfflineAudioContext`):** Renders faster-than-realtime using your cached `FluidR3_GM.sf2` SoundFont, including all active **Humanize**, **Predictive Tension (`-5..+5`)**, **Modal Voyager (`VOYAGE 🧭`)**, and **Time-Signature Sync** settings.
* **Formats:**
  * **`.WAV` (16-Bit Stereo PCM @ 44.1 kHz):** Uncompressed studio-quality master.
  * **`.MP3` (192 kbps Stereo via Web Worker):** Uses the locally bundled `./src/vendor/lame.min.js` inside a background Web Worker (works 100% offline in installed PWAs).

---

## 12. View 3: System Settings — Global Fine-Tuning Reference

| Settings Card | Parameter | Default | How It Alters Global Behavior |
| :--- | :--- | :---: | :--- |
| **MIDI Routing & Hardware Ports** | `Force Internal .sf2 Synth` | `ON` | Keeps internal SoundFont audio active even when virtual MIDI ports (macOS IAC / loopMIDI) are detected. |
| **Time Sig & Polyrhythm Sync** | `Sync Mode` | `Independent` | Switches between `Auto Bar-Fit`, `Independent Polymetric`, and `Master Bar Reset`. |
| **Humanize Engine — Global Impact** | `Max Micro-Timing Window`<br>`Max Velocity Jitter Span` | `24 ms` (`±12 ms`)<br>`30 vel` (`±15 vel`) | Scales the maximum timing spread (`4–80 ms`) and velocity variation (`4–80 vel`) produced at `100%` Humanize. |
| **Predictive Tension Engine** | `Tension Intensity Scale`<br>`Predictive Lookahead`<br>`Chord Substitution Mode` | `100%`<br>`Enabled`<br>`Extensions + Tritone Subs` | Scales how aggressively Tension `-5..+5` alters note density (`25%–200%`), toggles bar-end pickup fills, and locks/unlocks root substitutions. |
| **Modal Voyager Rules** | `Voyage Method`<br>`Return Home Gravity` | `Hybrid Blend`<br>`ON` | Sets the default mix of Parallel Modal / Pivot Modulation / Constant Structure and Bar 1 / Final Bar home-key resolution. |
| **Drum Hit Velocity Levels** | `Accent` / `Normal` / `Ghost` | `127` / `90` / `25` | Sets the exact MIDI velocity (`1–127`) sent by States `2`, `1`, and `3` in the Drum Lab Editor. |
| **10-Slot GM Drum Mapper** | `Slots #1 – #10` | Standard 10-Piece | Reassigns any of the 10 Drum Editor rows to any of the 47 General MIDI Channel 10 percussion pitches. |

---

## 13. Mouse, Drag & Keyboard Shortcuts Cheatsheet

| Action | Control / Gesture | Where |
| :--- | :--- | :--- |
| **Start / Stop Sequencer** | Click **`▶ START`** / **`■ STOP`** (or press `Spacebar`) | Top Transport Header |
| **Adjust Slot Tension (`-5` to `+5`)** | Click **`−` / `+`**, **Drag Up/Down**, **Scroll Mouse Wheel**, or **Double-Click** badge to reset to `0` | Under every Loop Slot on Main Stage |
| **Assign Pattern to Loop Slot** | Click a Loop Slot to select it $\rightarrow$ Click any tile in the **Pattern Palette** (or Drag & Drop tile onto slot) | Main Stage |
| **Reorder Loop Slots** | Drag & Drop one Loop Slot onto another within the same track | Main Stage |
| **Open Pattern Editor** | **Double-Click** any Loop Slot on the Main Stage (or **Double-Click** any tile in the Pattern Palette) | Main Stage |
| **Slide Bass Pitch / Scale Degree** | **Drag Up/Down** or **Scroll Mouse Wheel** on any **`↕` Pitch Pill** (Click to audition) | Bassline Editor |
| **Cycle Bass Step Gate Length** | Click the **Gate Bar** (`25% Stac` $\rightarrow$ `50% Std` $\rightarrow$ `100% Leg`) | Bassline Editor |
| **Protect Drum Row During `GENERATE 🎲`** | Enable **`M` (Mute)** on any Drum Row header before clicking **`GENERATE 🎲`** | Drum Lab Editor |
| **Silence a Chord Slot (`Ø`)** | Click the **`Ø`** button inside any chord slot (or clear the text / type `O`) | Chord Editor |
