# Album theme contrast audit

Ratios use WCAG relative luminance. AA targets: 4.5:1 normal text, 3:1 large text. The 17 album palettes are preserved exactly. hub adds a black/white/grey/orange palette (#FF9900 highlight) as the final option. phi retains the original labs CSS gold theme (#FFD700), with its original surface and text colours. Its swatch represents the original dark background, white foreground, darkgoldenrod detail and CSS gold accent. The label on filled highlight controls uses whichever existing palette token offers the highest contrast. Currents, 808s & Heartbreak, DAMN. and CALL ME IF YOU GET LOST have no available 4.5:1 button foreground, so the new picker Apply button uses bold text at 19px (the 3:1 large-text threshold). Existing control typography is preserved; the ratios below identify limitations in smaller existing controls.

| Theme | Primary / background | Secondary / background | Button / highlight |
|---|---:|---:|---:|
| phi | 19.44 | 5.97 | 13.86 |
| IGOR | 11.50 | 3.17 | 5.37 |
| CHROMAKOPIA | 12.10 | 4.95 | 9.54 |
| Graduation | 13.46 | 3.18 | 6.40 |
| To Pimp a Butterfly | 16.70 | 4.82 | 8.00 |
| GKMC Deluxe | 11.69 | 5.27 | 8.07 |
| Currents | 16.03 | 3.82 | 4.42 |
| 808s & Heartbreak | 10.68 | 6.70 | 4.10 |
| Yeezus | 19.80 | 5.10 | 5.42 |
| My Beautiful Dark Twisted Fantasy (MBDTF) | 3.54 | 2.14 | 12.20 |
| channel ORANGE | 2.44 | 1.84 | 16.09 |
| This Old Dog | 7.60 | 4.63 | 6.72 |
| Flower Boy | 15.18 | 4.24 | 9.92 |
| GNX | 16.05 | 4.89 | 11.42 |
| DAMN. | 5.15 | 8.15 | 4.47 |
| Blonde | 13.04 | 3.65 | 8.17 |
| Kids See Ghosts | 11.15 | 3.13 | 5.64 |
| CALL ME IF YOU GET LOST | 5.42 | 3.40 | 3.77 |
| hub | 21.00 | 5.32 | 9.81 |

channel ORANGE primary text fails even the large-text target. MBDTF primary text and several secondary colours fail normal-text AA. These are palette limitations, not silently adjusted colours. Proposed accessible alternatives can use the highlight token for body text in channel ORANGE and primary for supporting text where primary reaches 4.5:1; these require design review before changing the approved visual semantics.

1998 mode retains its separate stylesheet. Album themes apply to the modern site, including shared music and chat chrome; game pieces, chart signals and media artwork retain their semantic colours.
