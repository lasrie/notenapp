var authKey;
var authDate;
var storage = [];
var db;
var neueNoten;
angular.module('starter.controllers', ['ngCordova'])
  .run(function($ionicPlatform, $cordovaSQLite) {
    $ionicPlatform.ready(function () {
      db = $cordovaSQLite.openDB("my.db");
      $cordovaSQLite.execute(db, "CREATE TABLE IF NOT EXISTS data (id integer primary key, keyname text, value text)");
    });

  })
  .controller('DashCtrl', function($scope, $rootScope, $ionicUser, $ionicPush, $log) {

    // Handles incoming device tokens
    $rootScope.$on('$cordovaPush:tokenReceived', function(event, data) {
      alert("Successfully registered token " + data.token);
      $log.info('Ionic Push: Got token ', data.token, data.platform);
      $scope.token = data.token;
    });
    // Identifies a user with the Ionic User service
    $scope.identifyUser = function() {
      $log.info('Ionic User: Identifying with Ionic User service');

      var user = $ionicUser.get();
      if(!user.user_id) {
        // Set your user_id here, or generate a random one.
        user.user_id = $ionicUser.generateGUID();
      };

      // Add some metadata to your user object.
      angular.extend(user, {
        name: 'Ionitron',
        bio: 'I come from planet Ion'
      });

      // Identify your user with the Ionic User Service
      $ionicUser.identify(user).then(function(){
        $scope.identified = true;
        alert('Identified user ' + user.name + '\n ID ' + user.user_id);
      });
    };

    // Registers a device for push notifications and stores its token
    $scope.pushRegister = function() {
      $log.info('Ionic Push: Registering user');

      // Register with the Ionic Push service.  All parameters are optional.
      $ionicPush.register({
        canShowAlert: true, //Can pushes show an alert on your screen?
        canSetBadge: true, //Can pushes update app icon badges?
        canPlaySound: true, //Can notifications play a sound?
        canRunActionsOnWake: true, //Can run actions outside the app,
        onNotification: function(notification) {
          // Handle new push notifications here
           $log.info(notification);
          return true;
        }
      });
    };

  })

.controller('ChatsCtrl', function($scope, Chats) {
  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  };
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('AccountCtrl', function($scope, $timeout, $cordovaSQLite) {
  $scope.settings = {
    enableFriends: true
  };
    $scope.loginData = {};
    $scope.doLogin = function() {
      console.log('Doing login', $scope.loginData);
      var query = "INSERT OR REPLACE INTO data (keyname, value) VALUES (?,?)";
      $cordovaSQLite.execute(db, query, ["username", $scope.loginData.username]).then(function(res) {
        console.log("INSERT ID -> " + res.insertId);
      }, function (err) {
        console.error(err);
      });
      $cordovaSQLite.execute(db, query, ["pass", $scope.loginData.password]).then(function(res) {
        console.log("INSERT ID -> " + res.insertId);
      }, function (err) {
        console.error(err);
      });
    };
})
  .controller('myController',function ($scope, $http, $cordovaSQLite, $q, $ionicLoading, $timeout, $ionicPlatform, $cordovaPush, $cordovaDialogs, $cordovaMedia, $cordovaToast, ionPlatform) {

    $scope.notifications = [];
    $scope.location
    $scope.loading = false;
    $scope.storage = [];
    var user;
    var pass;
    var ReqCount;
    var RetCount;




    $scope.doLogin = function () {
      $ionicLoading.show({
        template: '<img id="cat" src="img/cat.GIF"><br/>Lädt die Noten...',
        duration: 10000
      });
      $scope.storage = [];
      storage = [];
        $scope.updateAuthKey().then(function(){
          grabUser().then(function(data) { //Nutzerdaten aus Datenbank auslesen
            user = data[0];
            pass = data[1];
            $scope.grabPruefungen().then(function () {
              console.log("Semester geholt");

              $scope.getPunkte();
            }, function () {

            });
          });
        });
    };


    /**
     *  Links zu den einzelnen Semesterseiten abrufen und die einzelnen Semester zu getSemester weitergeben
     */
    $scope.grabPruefungen = function () {
      var deferred = $q.defer();
      var onSuccess = function (response) {
        var dummyDOM = $('<div></div>');
        dummyDOM.html(response.data);
        parsePruefung(dummyDOM, storage).then(function(){ //Links zu den einzelnen Semestern abrufen
          for (var j = 0; j < storage.length; j++) {                 //Dann jede Semesterseite einzeln parsen
            if(j == storage.length -1){                              //Im letzten Durchlauf promise auflösen
              $scope.getSemester(j).then(function(){
                deferred.resolve();
              });
            }else{
              $scope.getSemester(j);
            }
          }
        })
      };
      pruefung().then(onSuccess);
      return deferred.promise;
    };


    /**
     * Semesteruebersichten abrufen und Modulpruefungen parsen
     * @param storageID
     */
    $scope.getSemester = function (storageID) {
      var deferred = $q.defer();
      var onSuccess = function (response) {
        var dummyDOM = $('<div></div>');
        dummyDOM.html(response.data);
        parseSeite(dummyDOM, storageID).then(function(args){//args: [pruefungen, storageID]
          storage[args[1]].pruefungen = args[0];
          deferred.resolve();
        }, function(){//onFailure, daten nicht geparsed und gespeichert
          deferred.reject();
        });

      };
      semester(storage[storageID].link).then(onSuccess);
      return deferred.promise;
    };



    /**
     * Punkte zu den Modulen abrufen
     */
    $scope.getPunkte = function () {
      var deferred = $q.defer();
      var aktStor;
      var aktPruef;
      ReqCount = 0;
      RetCount = 0;
      for (var i = 0; i < storage.length; i++) {
        for (var j = 0; j < storage[i].pruefungen.length; j++) {
          var aktLink = storage[i].pruefungen[j].link;
          ReqCount++;
          $scope.getPunkteZuPruefung(aktLink, i, j).then(function () {
            if (RetCount == ReqCount) {
              deferred.resolve();
            }
          }, function (err) {
            deferred.reject(err);
          });
        }

      }
      return deferred.promise;
    };
    /**
     * Punktergebnisse zu einer Prüfung abrufen
     * @param link Link zu der Prüfung
     * @param storID Index des Semesters
     * @param pruefID Index des Moduls/Prüfung
     * @param last Ist das ELement die letzte Prüfung in der Abfrage => Promise auflösung
     */
    $scope.getPunkteZuPruefung = function (link, storID, pruefID) {
      var deferred = $q.defer();
      var onSuccess = function (retObj) {
        var dummyDOM = $('<div></div>');
        dummyDOM.html(retObj.data);
        storage[retObj.config.headers.data1].pruefungen[retObj.config.headers.data2].punkte = parsePunkte(dummyDOM);
        console.log(storage[retObj.config.headers.data1].pruefungen[retObj.config.headers.data2].punkte)
        console.log( storage[retObj.config.headers.data1].pruefungen[retObj.config.headers.data2]);
        RetCount++;
        if(RetCount == ReqCount){
          $scope.storage = storage;
          $scope.saveStor().then(function(){
            deferred.resolve();
          }, function(err){
            deferred.reject(err);
          });
          $ionicLoading.hide();
        }
      };
        reqPunkteZuPruefung(link, storID, pruefID).req.then(onSuccess);
      return deferred.promise;
    };

    $scope.saveStor = function(){
      var deferred = $q.defer();

      var string, key;
      for(var i = 0; i< storage.length; i++){
        key="Sem"+0+i;
        window.localStorage[key] = JSON.stringify(storage[i]);
      }
      window.localStorage["SemCount"] = i;
      deferred.resolve();
      console.log("Daten gesichert");
      return deferred.promise;
    };
    $scope.loadData = function(){
      var deferred = $q.defer();
      var key, aktSem, tempStore;
      tempStore = [];
      var semCount = window.localStorage["SemCount"];
      if(semCount && !isNaN(semCount)){
        for(var i = 0; i<semCount; i++){
          key = "Sem"+0+i;
          aktSem = JSON.parse(window.localStorage[key]);
          tempStore[i] = aktSem;
        }
      }

      if($scope.storage.length > 0){
        deferred.reject();
      }else{
        $scope.storage = tempStore;
        storage = tempStore;
        deferred.resolve();
      }
      return deferred.promise;
    };

    $scope.update = function(){
      var newStorage;
      var deferred = $q.defer();
      $scope.updateAuthKey().then(function(){ //check for authkey and get new one if needed
        if(storage.length > 0){

          var onSuccess = function (response) {
            var dummyDOM = $('<div></div>');
            dummyDOM.html(response.data);
            parsePruefung(dummyDOM, newStorage);
              $scope.getSemester(i);

          };

          for(var i= 0; i< storage.length; i++){

            pruefung().then(onSuccess);
          }
        }else{
          $scope.doLogin(); //storage empty, crawl everything
        }

      });
    };

    $scope.updateAuthKey = function(){
      var deferred = $q.defer();
      var res;
      var diff = new Date() - authDate;
      if(authDate && diff < 1800000){ //authKey valid
        deferred.resolve();
      }else{ //grab new authKey
        grabUser().then(function(data){
          user = data[0];
          pass = data[1];


          var onSuccess = function (response) {
            var headers = response.headers();
            authKey = (headers.refresh.split(';'))[1];
            authKey = authKey.substring(authKey.indexOf('ARGUMENTS=-') + 11, authKey.length);
            authKey = authKey.substring(0, authKey.indexOf(','));
            authDate = new Date();
              if(authKey){
                deferred.resolve();
              }else{
                deferred.reject();
              }
          };
          var onSuccess1 = function (response) {
            prelogin2()
              .then(onSuccess2);
          };

          var onSuccess2 = function (response) {
            login(user, pass)
              .then(onSuccess);
          };

          prelogin()
            .then(onSuccess1);
        });

      }
      return deferred.promise;
    };
    //----------------------------------------------------------------------------------------------------------
    //----------------------------------------------Requests----------------------------------------------------
    //----------------------------------------------------------------------------------------------------------
    var prelogin = function () {
      var request = {
        method: 'GET',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=STARTPAGE_DISPATCH&ARGUMENTS=-N000000000000001',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Upgrade-Insecure-Requests' : 1}
      };
      return $http(request);
    };

    var prelogin2 =function () {
      var request = {
        method: 'GET',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=EXTERNALPAGES&ARGUMENTS=-N000000000000001,-N000324,-Awelcome',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Upgrade-Insecure-Requests' : 1}
      };
      return $http(request);
    };

    var login = function (username, password) {
      var request = {
        method: 'POST',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=EXTERNALPAGES&ARGUMENTS=-N000000000000001,-N000324,-Awelcome',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'usrname=' + username + '&pass=' + password + '&APPNAME=CampusNet&PRGNAME=LOGINCHECK&ARGUMENTS=clino%2Cusrname%2Cpass%2Cmenuno%2Cmenu_type%2Cbrowser%2Cplatform&clino=000000000000001&menuno=000324&menu_type=classic&browser=&platform='
      };
      return $http(request);
    };

    var pruefung = function() {
      var request = {
        method: 'GET',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=COURSERESULTS&ARGUMENTS=-' + authKey + ',-N000307,',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'APPNAME=CampusNet&PRGNAME=COURSERESULTS&ARGUMENTS=-' + authKey +',-N000307,'
      };
      return $http(request);
    };

    var semester = function(link) {
      var request = {
        method: 'GET',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=COURSERESULTS&ARGUMENTS=-' + authKey + ',-N000307,-N' + link,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'APPNAME=CampusNet&PRGNAME=COURSERESULTS&ARGUMENTS=-' + authKey +',-N000307,-N' +link
      };
      return $http(request);
    };

    var reqPunkteZuPruefung = function(pruefungID, storID, pruefStorID) {
      var request = {
        method: 'GET',
        url: 'https://dualis.dhbw.de/scripts/mgrqcgi?APPNAME=CampusNet&PRGNAME=RESULTDETAILS&ARGUMENTS=-' + authKey + ',-N000307,-N' + pruefungID,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'data1': storID,
          'data2':pruefStorID},
        data: 'APPNAME=CampusNet&PRGNAME=RESULTDETAILS&ARGUMENTS=-' + authKey +',-N000307,-' +pruefungID
      };
      var retObj = {'req': $http(request), 'storID' : storID, 'pruefID': pruefStorID};
      return retObj;
    };

    //----------------------------------------------------------------------------------------------------------
    //----------------------------------------------PARSE-------------------------------------------------------
    //----------------------------------------------------------------------------------------------------------
    var parsePunkte = function(dummyDOM){
      var punkte = [];
      var nblistChildren = $('table:first-of-type',dummyDOM).children();
      nblistChildren = nblistChildren[0].children;
      var aktReihe;
      for(var i = 0; i<nblistChildren.length;i++){
        aktReihe = nblistChildren[i];
        if(aktReihe.textContent.length < 5){
          console.log("aktReihe leer");
        }else if((aktReihe.textContent.indexOf("Versuch") != -1)){
          console.log("aktReihe Versuch");
        }else if((aktReihe.textContent.indexOf("Modulabschlussleistung")) != -1){
          console.log("aktReihe Modulabschlussleistung");
        }else if((aktReihe.textContent.indexOf("Gesamt ")) != -1){
          console.log("aktReihe Gesamt");
        }else{
          var reihe = aktReihe.children;
          var tempArr = [];
          var tC;
          for(var j = 0; j<reihe.length; j++){
            tC = reihe[j].textContent;
            tC = tC.replace(/\s/, "");
            tC = tC.replace("  ", " ");
            if(tC.length >1){
              tempArr.push(tC);
            }
          }
          punkte.push(tempArr);
        }
      }
      return punkte;
    };

    //Links zu den einzelnen Semestern abrufen
    var parsePruefung = function(dummyDOM, locStor){
      var deferred = $q.defer();
      var options = ($('#semester', dummyDOM)[0]).children;
      for(var i = 0; i<options.length; i++){
        var tempsem = {};
        tempsem.semester = options[i].textContent;
        tempsem.link = options[i].value;
        tempsem.pruefungen = {};
        locStor.push(tempsem);
      }
      deferred.resolve();
      return deferred.promise;
    };

    var parseSeite = function(dummyDOM, storageID){
      var deferred = $q.defer();
      var pruefungen = [];
      var nblistChildren = $('.nb.list',dummyDOM).children();
      $('tr', nblistChildren).each(function( index, value ) {
        var pruefung = {};
        if(!(value.children[1].textContent == "Name" || value.children[0].textContent == "Semester-GPA")) {
          for (var i = 0; i < value.children.length; i++) {
            var aktIndex;
            switch (i) {
              case 0:
                pruefung.id = value.children[i].textContent;
                break;
              case 1:
                pruefung.name = value.children[i].textContent;
                break;
              case 2:
                pruefung.endnote = value.children[i].textContent;
                if(typeof(pruefung.endnote) == String && pruefung.endnote.contains("noch nicht gesetzt") != -1){
                  pruefung.finished = true;
                }else{
                  pruefung.finished = false;
                }
                break;
              case 3:
                pruefung.credits = value.children[i].textContent;
                break;
              case 4:
                pruefung.maluspunkte = value.children[i].textContent;
                break;
              case 5:
                pruefung.status = value.children[i].textContent;
                break;
              case 6:
                try {
                  var link = ((value.children[i]).children[0]).href;
                  link = link.substring(link.indexOf("N000307,-") + 10, link.length);
                  link = link.substring(0, link.indexOf(",-N"));
                  pruefung.link = link;
                } catch (e) {
                  pruefung.link = "";
                }
                break;
            }
          }
          pruefungen.push(pruefung);
        }
      });
        if(pruefungen.length != 0){
          deferred.resolve([pruefungen, storageID]);
        }else{
          deferred.reject();
        }
      return deferred.promise;
    };

    $scope.select = function(keyname) {
      var deferred = $q.defer();
      var query = "SELECT keyname, value FROM data WHERE keyname = ?";
      $cordovaSQLite.execute(db, query, [keyname]).then(function(res) {
        if(res.rows.length > 0) {
          console.log("SELECTED -> " + res.rows.item(0).keyname + " " + res.rows.item(0).value);
          return $q(function(){
            if(res.rows.length==1){
              deferred.resolve(res.rows.item(0).value);
            }else{
              deferred.reject(res.rows);
            }
          });

        } else {
          deferred.resolve([]);
          console.log("No results found");
        }
      }, function (err) {
        console.error(err);
      });
      return deferred.promise;
    };

    $scope.insert = function(key, value) {
      var deferred = $q.defer();
      var query = "INSERT OR REPLACE INTO data (keyname, value) VALUES (?,?)";
      $cordovaSQLite.execute(db, query, [key, value]).then(function(res) {
        console.log("INSERT ID -> " + res.insertId);
        $q.resolve();
      }, function (err) {
        $q.reject(err);
        console.error(err);
      });
      return deferred.promise;
    };

    var grabUser = function(){
      var deferred = $q.defer();
      var pass, user;
      $scope.select('username').then(function(data){
          user = data;
          $scope.select('pass').then(function(data) {
            pass = data;
            deferred.resolve([user, pass]);

          }, function(){
            deferred.reject();
          });
        },function() {
          deferred.reject();
        }
      );
      return deferred.promise;
    };

    $ionicPlatform.ready(function() {
      $scope.loadData();
    });

    //#################################################################################################################
    //                                                PUSH
    //#################################################################################################################
    //Register
    $scope.register = function () {
      var config = null;

      if (ionic.Platform.isAndroid()) {
        config = {
          "senderID": "472769534306"
        };
      }
      else if (ionic.Platform.isIOS()) {
        config = {
          "badge": "true",
          "sound": "true",
          "alert": "true"
        }
      }

      $cordovaPush.register(config).then(function (result) {
        console.log("Register success " + result);

        $cordovaToast.showShortCenter('Registered for push notifications');
        $scope.registerDisabled=true;
        // ** NOTE: Android regid result comes back in the pushNotificationReceived, only iOS returned here
        if (ionic.Platform.isIOS()) {
          $scope.regId = result;
          storeDeviceToken("ios");
        }
      }, function (err) {
        console.log("Register error " + err)
      });
    };

    // Notification Received
    $scope.$on('$cordovaPush:notificationReceived', function (event, notification) {
      console.log(JSON.stringify([notification]));
      if (ionic.Platform.isAndroid()) {
        handleAndroid(notification);
      }
      else if (ionic.Platform.isIOS()) {
        handleIOS(notification);
        $scope.$apply(function () {
          $scope.notifications.push(JSON.stringify(notification.alert));
        })
      }
    });

    // Android Notification Received Handler
    function handleAndroid(notification) {
      // ** NOTE: ** You could add code for when app is in foreground or not, or coming from coldstart here too
      //             via the console fields as shown.
      console.log("In foreground " + notification.foreground  + " Coldstart " + notification.coldstart);
      if (notification.event == "registered") {
        $scope.regId = notification.regid;
        storeDeviceToken("android");
      }
      else if (notification.event == "message") {
        $cordovaDialogs.alert(notification.message, "Push Notification Received");
        $scope.$apply(function () {
          $scope.notifications.push(JSON.stringify(notification.message));
        })
      }
      else if (notification.event == "error")
        $cordovaDialogs.alert(notification.msg, "Push notification error event");
      else $cordovaDialogs.alert(notification.event, "Push notification handler - Unprocessed Event");
    }

    // IOS Notification Received Handler
    function handleIOS(notification) {
      // The app was already open but we'll still show the alert and sound the tone received this way. If you didn't check
      // for foreground here it would make a sound twice, once when received in background and upon opening it from clicking
      // the notification when this code runs (weird).
      if (notification.foreground == "1") {
        // Play custom audio if a sound specified.
        if (notification.sound) {
          var mediaSrc = $cordovaMedia.newMedia(notification.sound);
          mediaSrc.promise.then($cordovaMedia.play(mediaSrc.media));
        }

        if (notification.body && notification.messageFrom) {
          $cordovaDialogs.alert(notification.body, notification.messageFrom);
        }
        else $cordovaDialogs.alert(notification.alert, "Push Notification Received");

        if (notification.badge) {
          $cordovaPush.setBadgeNumber(notification.badge).then(function (result) {
            console.log("Set badge success " + result)
          }, function (err) {
            console.log("Set badge error " + err)
          });
        }
      }
      // Otherwise it was received in the background and reopened from the push notification. Badge is automatically cleared
      // in this case. You probably wouldn't be displaying anything at this point, this is here to show that you can process
      // the data in this situation.
      else {
        if (notification.body && notification.messageFrom) {
          $cordovaDialogs.alert(notification.body, "(RECEIVED WHEN APP IN BACKGROUND) " + notification.messageFrom);
        }
        else $cordovaDialogs.alert(notification.alert, "(RECEIVED WHEN APP IN BACKGROUND) Push Notification Received");
      }
    }

    // Stores the device token in a db using node-pushserver (running locally in this case)
    //
    // type:  Platform type (ios, android etc)
    function storeDeviceToken(type) {
      // Create a random userid to store with it
      var user = { user: 'user' + Math.floor((Math.random() * 10000000) + 1), type: type, token: $scope.regId };
      console.log("Post token for registered device with data " + JSON.stringify(user));

        $http.post('http://pusher:e2kc8!b28@push.lriess.de', JSON.stringify(user)) //http://pusher:e2kc8!b28@push.lriess.de
        .success(function (data, status) {
            console.log("Token stored, device is successfully subscribed to receive push notifications.");
        })
        .error(function (data, status) {
          console.log("Error storing device token." + data + " " + status)
        }
      );
    }

    // Removes the device token from the db via node-pushserver API unsubscribe (running locally in this case).
    // If you registered the same device with different userids, *ALL* will be removed. (It's recommended to register each
    // time the app opens which this currently does. However in many cases you will always receive the same device token as
    // previously so multiple userids will be created with the same token unless you add code to check).
    function removeDeviceToken() {
      var tkn = {"token": $scope.regId};
        $http.post('http://pusher:e2kc8!b28@push.lriess.de', JSON.stringify(tkn))
        .success(function (data, status) {
          console.log("Token removed, device is successfully unsubscribed and will not receive push notifications.");
        })
        .error(function (data, status) {
          console.log("Error removing device token." + data + " " + status)
        }
      );
    }

    // Unregister - Unregister your device token from APNS or GCM
    // Not recommended:  See http://developer.android.com/google/gcm/adv.html#unreg-why
    //                   and https://developer.apple.com/library/ios/documentation/UIKit/Reference/UIApplication_Class/index.html#//apple_ref/occ/instm/UIApplication/unregisterForRemoteNotifications
    //
    // ** Instead, just remove the device token from your db and stop sending notifications **
    $scope.unregister = function () {
      console.log("Unregister called");
      removeDeviceToken();
      $scope.registerDisabled=false;
      //need to define options here, not sure what that needs to be but this is not recommended anyway
//        $cordovaPush.unregister(options).then(function(result) {
//            console.log("Unregister success " + result);//
//        }, function(err) {
//            console.log("Unregister error " + err)
//        });
    }
  })


  .controller('DetailCtrl', function($scope, $stateParams) {

    var pruefungFuerID = function (id) {
      for (var i = 0; i < storage.length; i++) {
        for (var j = 0; j < storage[i].pruefungen.length; j++) {
          if (storage[i].pruefungen[j].id == id) {
            return storage[i].pruefungen[j];
          }
        }
      }
      return null;
    };

    $scope.id = $stateParams.pruefID;
    var pruefung = pruefungFuerID($scope.id);
    if (pruefung != null) {
      $scope.pruefung = pruefung;
    }


  });






