"use strict";
/* globals AccountsPatchUi, Iron */

function wrapRouteHooksWithSignedUp(route) {
  _.each(Iron.Router.HOOK_TYPES, function(hookType) {
    if (_.isFunction(route.options[hookType])) {
      route.options[hookType] =
        AccountsPatchUi.wrapWithSignedUp(route.options[hookType]);
    }
  });
}

function wrapFlowRouteHooksWithSignedUp(route) {
  if (_.isFunction(route._action)) {
    route._action = AccountsPatchUi.wrapWithSignedUp(route._action);
  }
  _.each(['triggersEnter', 'triggersExit'], function(hookType) {
    if (_.isArray(route.options[hookType])) {
      _.each(route.options[hookType], function(cb, i, arr) {
        if (_.isFunction(cb)) {
          arr[i] = AccountsPatchUi.wrapWithSignedUp(cb);
        }
      });
    }
  });
}

AccountsPatchUi._wrapTemplate(Template.atNavButton);
AccountsPatchUi._wrapTemplate(Template.atForm);

var AccountsTemplates =
  Package['useraccounts:core'] &&
  Package['useraccounts:core'].AccountsTemplates;

var submitCallback = AccountsTemplates && AccountsTemplates.submitCallback;
if (submitCallback) {
  AccountsTemplates.submitCallback
    = AccountsPatchUi.wrapWithMergedErrorSuppressed(submitCallback);
}
if (Package['useraccounts:iron-routing']) {
  var IronRouter = Package['iron:router'] && Package['iron:router'].Router;
  if (AccountsTemplates && AccountsTemplates.routes && IronRouter) {
    _.each(AccountsTemplates.routes, function(r) {
      var route = IronRouter.routes[r.name];
      wrapRouteHooksWithSignedUp(route);
    });
  }

  if (AccountsTemplates && AccountsTemplates.configureRoute && IronRouter) {
    var origConfigureRoute = AccountsTemplates.configureRoute;
    AccountsTemplates.configureRoute = function(routeCode, options) {
      var ret = origConfigureRoute.call(this, routeCode, options);
      var route = IronRouter.routes[AccountsTemplates.routes[routeCode].name];
      wrapRouteHooksWithSignedUp(route);
      return ret;
    };

    var origEnsureSignedIn = AccountsTemplates.ensureSignedIn;
    AccountsTemplates.ensureSignedIn =
      AccountsPatchUi.wrapWithSignedUp(origEnsureSignedIn);

    var origEnsureSignedInPlugin = Iron.Router.plugins.ensureSignedIn;
    Iron.Router.plugins.ensureSignedIn = function(router, options) {
      var origMethods = {};
      _.each(['onBeforeAction', 'onAfterAction', 'onRerun', 'onRun', 'onStop'],
        function(methodName) {
          if (_.isFunction(router[methodName])) {
            origMethods[methodName] = router[methodName];
            router[methodName] = function(hook, options) {
              return origMethods[methodName].
                call(router, AccountsPatchUi.wrapWithSignedUp(hook), options);
            };
          }
        }
      );
      var ret;
      try {
        ret = origEnsureSignedInPlugin(router, options);
      } finally {
        _.each(_.keys(origMethods), function(methodName) {
          router[methodName] = origMethods[methodName];
        });
      }
      return ret;
    };
  }
} else if (Package['useraccounts:flow-routing']) {
  var FlowRouter =
    Package['kadira:flow-router'] && Package['kadira:flow-router'].FlowRouter;
  if (AccountsTemplates && AccountsTemplates.routes && FlowRouter) {
    _.each(AccountsTemplates.routes, function(r, key) {
      var route = lookupFlowRoute(r.name, key);
      wrapFlowRouteHooksWithSignedUp(route);
    });
  }

  if (AccountsTemplates && AccountsTemplates.configureRoute && FlowRouter) {
    var origConfigureRoute = AccountsTemplates.configureRoute;
    AccountsTemplates.configureRoute = function(routeCode, options) {
      var ret = origConfigureRoute.call(this, routeCode, options);
      var route =
        lookupFlowRoute(AccountsTemplates.routes[routeCode].name, routeCode);
      wrapFlowRouteHooksWithSignedUp(route);
      return ret;
    };

    var origEnsureSignedIn = AccountsTemplates.ensureSignedIn;
    AccountsTemplates.ensureSignedIn =
      AccountsPatchUi.wrapWithSignedUp(origEnsureSignedIn);

    var origButtonText = AccountsTemplates.atSocialHelpers.buttonText;
    AccountsTemplates.atSocialHelpers.buttonText =
      AccountsPatchUi.wrapWithSignedUp(origButtonText);
  }
}

function lookupFlowRoute(name, code) {
  var route = FlowRouter._routesMap[name];
  // Looks like configureRoute sometimes uses the route code instead of the
  // route name. Probably a bug.
  if (!route) {
    route = FlowRouter._routesMap[code];
  }
  return route;
}
