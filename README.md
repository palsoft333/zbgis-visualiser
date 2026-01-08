# zbgis-visualiser
This tool allows visualization and information fetching of all E &amp; C-ground plots for a given name in Slovak Cadastre of Real Estate (zbgis.skgeodesy.sk)

## Requirements
- Chrome, Microsoft Edge, Safari, Opera Next or Firefox browser
- [Tampermonkey browser extension](https://www.tampermonkey.net/index.php)

## Installation
1. Download [Tampermonkey browser extension](https://www.tampermonkey.net/index.php) suited for your browser
2. In the Tampermonkey **Settings** tab, **General** section, set **Config mode** to ```Advanced```
3. In the Tampermonkey **Settings** tab, **Security** section, set **Allow scripts to access cookies** to ```All```
4. In the Tampermonkey **Utilities** tab, set **Import from URL** to ```https://raw.githubusercontent.com/palsoft333/zbgis-visualiser/refs/heads/main/zbgis-visualiser.js``` and click **Install**

## How to use it
1. visit [https://zbgis.skgeodesy.sk/mkzbgis/sk/kataster](https://zbgis.skgeodesy.sk/mapka/sk/kataster), click somewhere in the map and pass the captcha test
2. at the right side of the screen you should see a green button indicating that the ZBGIS Visualiser is working (you can stop the script anytime by clicking the button):
<img width="55" height="170" alt="image" src="https://github.com/user-attachments/assets/84ab6a4f-707e-44a6-9965-00bd622ab1fe" />

3. type the city (cadastral unit) into the search bar and lock it with the lock icon on the right
<img width="445" height="104" alt="image" src="https://github.com/user-attachments/assets/d880049d-f04d-42fa-9ec6-784d97d8216d" />

4. type person in the search bar and select appropriate search result
5. for the very first run of the script, you will be asked to ```Always Allow``` the Tampermonkey script to access the webpage
6. you may need to Refresh the zbgis website and repeat the steps from step 3 after allowing the script

## What information I could get?
- you will be shown all of E (red) & C (blue)-ground plots on the map with all of the shares calculated:
  
<img width="1445" height="853" alt="image" src="https://github.com/user-attachments/assets/5eff18c0-4d71-49f2-9c72-a01c2d14e3fb" />

Any help testing and/or pull requesting greatly appreciated.

If you like it:<br>
<a href="https://www.buymeacoffee.com/palsoft" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>
