// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {WorkPackageResource} from 'core-app/modules/hal/resources/work-package-resource';
import {WorkPackageCommentField} from './wp-comment-field.module';
import {ErrorResource} from 'core-app/modules/hal/resources/error-resource';
import {WorkPackageNotificationService} from '../../wp-edit/wp-notification.service';
import {WorkPackageCacheService} from '../work-package-cache.service';
import {LoadingIndicatorService} from '../../common/loading-indicator/loading-indicator.service';
import {scopedObservable} from 'core-app/helpers/angular-rx-utils';
import {WorkPackagesActivityService} from 'core-components/wp-single-view-tabs/activity-panel/wp-activity.service';

export class CommentFieldDirectiveController {
  public workPackage:WorkPackageResource;
  public field:WorkPackageCommentField;

  protected text:Object;

  protected editing = false;
  protected canAddComment:boolean;
  protected showAbove:boolean;
  protected _forceFocus:boolean = false;

  constructor(protected $scope:ng.IScope,
              protected $rootScope:ng.IRootScopeService,
              protected $timeout:ng.ITimeoutService,
              protected $q:ng.IQService,
              protected $element:ng.IAugmentedJQuery,
              protected wpActivityService:any,
              protected wpLinkedActivities:WorkPackagesActivityService,
              protected ConfigurationService:any,
              protected loadingIndicator:LoadingIndicatorService,
              protected wpCacheService:WorkPackageCacheService,
              protected wpNotificationsService:WorkPackageNotificationService,
              protected NotificationsService:any,
              protected I18n:op.I18n) {

    this.text = {
      editTitle: I18n.t('js.label_add_comment_title'),
      addComment: I18n.t('js.label_add_comment'),
      cancelTitle: I18n.t('js.label_cancel_comment'),
      placeholder: I18n.t('js.label_add_comment_title')
    };
  }

  public $onInit() {
    this.canAddComment = !!this.workPackage.addComment;
    this.showAbove = this.ConfigurationService.commentsSortedInDescendingOrder();

    scopedObservable<string>(this.$scope, this.wpActivityService.quoteEvents.values$())
      .subscribe((quote:string) => {
      this.activate(quote);
      this.$element.find('.work-packages--activity--add-comment')[0].scrollIntoView();
    });
  }

  public get htmlId() {
    return 'wp-comment-field';
  }

  public get active() {
    return this.editing;
  }

  public get inEditMode() {
    return false;
  }

  public shouldFocus() {
    return this._forceFocus;
  }

  public activate(withText?:string) {
    this._forceFocus = true;
    this.editing = true;

    this.resetField(withText);

    this.waitForField()
      .then(() => {
        this.field.$onInit(this.$element);
    });
  }

  public get project() {
    return this.workPackage.project;
  }

  public resetField(withText?:string) {
    this.field = new WorkPackageCommentField(this.workPackage);
    this.field.initializeFieldValue(withText);
  }

  public handleUserSubmit() {
    this.field.onSubmit();
    if (this.field.isBusy || this.field.isEmpty()) {
      return;
    }

    this.field.isBusy = true;
    let indicator = this.loadingIndicator.wpDetails;
    indicator.promise = this.wpActivityService.createComment(this.workPackage, this.field.value)
      .then(() => {
        this.editing = false;
        this.NotificationsService.addSuccess(this.I18n.t('js.work_packages.comment_added'));

        this.wpLinkedActivities.require(this.workPackage, true);
        this.wpCacheService.updateWorkPackage(this.workPackage);
        this._forceFocus = true;
        this.field.isBusy = false;
      })
      .catch((error:any) => {
        this.field.isBusy = false;
        if (error instanceof ErrorResource) {
          this.wpNotificationsService.showError(error, this.workPackage);
        }
        else {
          this.NotificationsService.addError(this.I18n.t('js.work_packages.comment_send_failed'));
        }
      });
  }

  public handleUserCancel() {
    this.editing = false;
    this.field.initializeFieldValue();
    this._forceFocus = true;
  }

  // Ensure the nested ng-include has rendered
  private waitForField():Promise<JQuery> {
    const deferred = this.$q.defer<JQuery>();

    const interval = setInterval(() => {
      const container = this.$element.find('.op-ckeditor-element');

      if (container.length > 0) {
        clearInterval(interval);
        deferred.resolve(container);
      }
    }, 100);

    return deferred.promise;
  }
}

function workPackageComment():any {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: '/components/work-packages/work-package-comment/work-package-comment.directive.html',
    scope: {
      workPackage: '='
    },

    controllerAs: 'vm',
    bindToController: true,
    controller: CommentFieldDirectiveController
  };
}

angular
  .module('openproject.workPackages.directives')
  .directive('workPackageComment', workPackageComment);
