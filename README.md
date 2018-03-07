# Arduspresso: a smart way for keeping track of coffee you drink in your office


> Arduspresso is a smart way for tracking who consumes coffee in an office.
Instead of using a volatile piece of paper, you can just mark a coffee on your
account by simply scanning your fingerprint, and the information will be stored on a
local db. A blinking led and a message on Telegram will also notify you about the track you left.


## How does it work?
For this project I used a raspberry pi Zero, an arduino Nano, and a [fingerprint
sensor ](https://www.adafruit.com/product/751).
A NodeJS script is running on a Pi Zero, waiting for messages coming from arduino. The script is in charge of performing all the db operations and runs a Telegram bot used for the communication with the user.
The arduino simply runs a sketch for capturing fingerprints from the sensor,
sending them back to the Pi.

<img src="/pics/final_img.jpg " width="40%">


## Usage
Clone the repository:
```
$ git clone git@github.com:lukesmolo/Arduspresso.git
```
Link all the wires to the arduino pins, following this [guide](https://learn.adafruit.com/adafruit-optical-fingerprint-sensor/overview).
Compile the sketch and upload it on arduino.


Create a [new Telegram Bot](https://core.telegram.org/bots#3-how-do-i-create-a-bot) and put your
Telegram token inside the <i>index.js</i> script.
<b>Since users are identified by the Telegram username inside the db, you MUST
check that your Telegram username is properly set.</b>
Put also your mongodb url, install all required modules and start the NodeJS script on Pi.

```javascript
npm install
node index.js
```
There are 4 commands in the bot:
1. <b>/add\_user</b>: create a new user following the instructions and enroll his first
   fingerpint
2. <b>/recharge</b>: recharge your account with a number of coffee
3. <b>/new\_fingerprint</b>: enroll a new fingerprint for the user
4. <b>/my\_credi</b>t: get your credit

## License
Arduspresso is released under the MIT License.


