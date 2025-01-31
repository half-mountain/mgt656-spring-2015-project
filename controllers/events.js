'use strict';


var events = require('../models/events');
var validator = require('validator');
var lodash = require('lodash');
var express = require('express');
var mongo = require('mongodb');
var monk = require('monk');
// var mongoUri = process.env.MONGOLAB_URI;

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

if (process.env.NODE_ENV === 'development') {
  var db = monk("mongodb://localhost:27017/halfmountain")
}
if (process.env.NODE_ENV === 'production') {
  var db = monk(process.env.MONGOLAB_URI);
}

if (process.env.NODE_ENV === 'testing') {
  var db = monk("mongodb://localhost:27017/halfmountain");
}

var collection = db.get('eventlist');

// Date data that would be useful to you
// completing the project These data are not
// used a first.
//
var allowedDateInfo = {
  months: {
    0: 'January',
    1: 'February',
    2: 'March',
    3: 'April',
    4: 'May',
    5: 'June',
    6: 'July',
    7: 'August',
    8: 'September',
    9: 'October',
    10: 'November',
    11: 'December'
  },
  minutes: [0, 30],
  days: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
  hours: [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
  ],
  years: [2015, 2016]
};



/**
 * Controller that renders a list of events in HTML.
 */


function listEvents(request, response) {

  events.getAll().success(function (eventList) {
    var contextData = {
      'title': 'Who Brings What | Events',
      'events': eventList
    };
    response.render('event', contextData);

  }).error(function (err) {
    throw err;
  });

}


/**
 * Controller that renders a page for creating new events.
 */
function newEvent(request, response){

  var contextData = {
    'title': 'Who Brings What | New',
    allowedDateInfo: allowedDateInfo
  };
  response.render('create-event', contextData);

}


function isRangedInt(number, name, min, max, errors){
  if(validator.isInt(number)){
    var numberAsInt = parseInt(number);
    if(number >= min && number <= max){
      return;
    }
  }
  errors.push(name + " should be an int in the range " + min + " to " + max);
}



function saveEvent(req, res){

    var thingsToBring = [];
    thingsToBring.push(req.body.items);
    events.getMaxId(function (maxId) {
      var newEvent = {
        id: maxId + 1,
        title: req.body.title,
        location: req.body.location,
        image: req.body.image,
        date: new Date(req.body.year, req.body.month, req.body.day, req.body.hour, req.body.minute),
        attending: [],
        items: thingsToBring
      };

      var contextData = {errors: [], allowedDateInfo: allowedDateInfo};

        if (validator.isLength(req.body.title, 5, 50) === false) {
          contextData.errors.push('Your title should be between 5 and 100 letters.');
        }

        if (validator.isLength(req.body.location, 5, 50) === false) {
          contextData.errors.push('Your location should be less than 50 characters.');
        }

        isRangedInt(req.body.year, "year", allowedDateInfo.years[0], allowedDateInfo.years[allowedDateInfo.years.length-1], contextData.errors);
        isRangedInt(req.body.day, "day", allowedDateInfo.days[0], allowedDateInfo.days[allowedDateInfo.days.length-1], contextData.errors);
        isRangedInt(req.body.hour, "hour", allowedDateInfo.hours[0], allowedDateInfo.hours[allowedDateInfo.hours.length-1], contextData.errors);
        isRangedInt(req.body.minute, "minute", allowedDateInfo.minutes[0], allowedDateInfo.minutes[allowedDateInfo.minutes.length-1], contextData.errors);
        isRangedInt(req.body.month, "month", 0, 11, contextData.errors);

        if (!validator.isURL(req.body.image, {require_protocol: true})) {
          contextData.errors.push('Please provide an online image url (http://...)')
        }

        if (req.body.image.match(/\.(gif|png)$/i) === null ){
          contextData.errors.push('Your image should be a png or gif');
        }

      if (contextData.errors.length === 0) {
        events.collection.insert( newEvent , function (err, doc) {
            if (err) {
                // If it failed, return error
                res.status(404).send("There was a problem adding the information to the database.");
            }
            else {
                // And forward to success page
                // events.all.push(newEvent);
                res.redirect('/events/' + newEvent.id);
            }
        });
      } else {
        res.render('create-event', contextData);
      }
    }, function (error){
      throw error;
    });

  };

function eventDetail (req, res) {

  events.getById(parseInt(req.params.id)).success(function(ev) {
      if (ev === null) {
        res.status(404).send('404 Error: No such event');
      }
      else {
        res.render('event-detail', {'title': ev.title, event: ev});
      }
    }).error(function(err) {
      console.log(err);
    });
}




function addThingToBring (req, res) {
  // takes the incoming params id and identifies the event user wants to RSVP to and then stores in variable "ev"
  events.getById(parseInt(req.params.id)).success(function(ev){
    if (ev === null) {
      res.status(404).send('404 Error: No such event');
    }
    if (ev.items === undefined) {
      ev.items = [];
    }
    ev.items.push(req.body.item);
    events.collection.findAndModify(
      {"_id": ev._id}, // query
      {$set: {items: ev.items}},
      function(err, object) {
          if (err){
              console.warn("oops");  // returns error if no matching object found
          }else{
              res.redirect('/events/' + ev.id);
          }
      });

    });
}


// what is called when someone rsvps to an event
function rsvp (request, response){

  // takes the incoming params id and identifies the event user wants to RSVP to and then stores in variable "ev"
  events.getById(parseInt(request.params.id)).success(function(ev){
    if (ev === null) {
      response.status(404).send('404 Error: No such event');
    }
    if (validator.isEmail(request.body.email) && request.body.email.toLowerCase().indexOf('@yale.edu') !== -1){
      var email = request.body.email;
      ev.attending.push(email);
      // JW: Is this anyway you can modify an object instead of querying for it again?
      events.collection.findAndModify(
        {"_id": ev._id}, // query
        {$set: {attending: ev.attending}},
        function(err, object) {
            if (err){
                console.warn("oops");  // returns error if no matching object found
            }else{
                response.redirect('/events/' + ev.id);
            }
        });

    } else{
      var contextData = {errors: [], event: ev};
      if(request.body.email.toLowerCase().indexOf('harvard') !== -1){
        contextData.errors.push('Harvard not allowed!');
      }else{
        contextData.errors.push('Invalid email! Are you a Yale student?');
      }
      response.render('event-detail', contextData);
    }
  });
}


function removeEvent (req, res) {
    events.collection.remove({"id": parseInt(req.params.id)}, function(err) {
      if (err) {
        throw err;
      }else{
        res.redirect('/events');
      }
    });
}


/**
 * Export all our functions (controllers in this case, because they
 * handles requests and render responses).
 */
module.exports = {
  'listEvents': listEvents,
  'eventDetail': eventDetail,
  'removeEvent': removeEvent,
  'newEvent': newEvent,
  'saveEvent': saveEvent,
  'rsvp': rsvp,
  'addThingToBring': addThingToBring
};
