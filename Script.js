/* exported Script */

/* globals console, _, s */

/** Global Helpers
 *
 * console - A normal console instance
 * _    - An underscore instance
 * s    - An underscore string instance
 */

class Script {
    /*
     * Helper function for logging.
     * View logs from Administration -> View Logs
     *
     * @params {object} message to log to console
     */
    do_log = function (message) {
        // Uncomment the following line to disable logging.
        console.log(message);
    }

    /**
     * @params {object} request
     */
    process_incoming_request({request}) {
        // request.url.hash
        // request.url.search
        // request.url.query
        // request.url.pathname
        // request.url.path
        // request.url_raw
        // request.url_params
        // request.headers
        // request.user._id
        // request.user.name
        // request.user.username
        // request.content_raw
        // request.content


        this.do_log("\n\n------- START REQUEST -------\n");
        this.do_log(request.content);
        this.do_log("\n--------END REQUEST ------\n\n");

        const data = request.content.data;

        /*
         * Extract author from Taiga event.
         */
        var author_name = request.content.by.full_name;
        var author_link = request.content.by.permalink;
        var author_icon = request.content.by.photo;
        var author_anchor = `[${author_name}](${author_link})`

        // The author's name and photo is displayed as the 'sender' in Rocket.Chat
        var sender_name = author_name;
        var sender_icon = author_icon;

        // If the event belongs to specific project, display the project's icon & name as sender instead
        if (request.content.data.project) {
            sender_name = request.content.data.project.name;
            sender_icon = request.content.data.project.logo_big_url;
        }

        /*
        * Initialize the message.
        */
        var message_emoji = "";
        var message_text = "";
        var attachment_title = "";
        var attachment_link = "";
        var attachment_anchor = "";

        var attachment_text = "";  // unused for now
        var attachment_image = ""; // unused for now
        var attachment_thumb = ""; // unused for now

        /*
         * The metadata is a supplementary information which indicates what exactly was added/changed/deleted.
         * If something has changed, the "change" key will be present in the request content:
         * {..., "change" : {diff: {some_item: {from: "foo", to: "bar" } }} , ...}
         * Sometimes, the type of "diff" is string.
         */
        var itemMeta = "";

        // Tag the @person if the person assigned to the task/issue/item is available on Rocket.Chat.
        // If the users don't share the same username, remove this if-block.
        if (data.assigned_to) {
            itemMeta = `@${data.assigned_to.username}`;
        }

        const diff = request.content.change ? request.content.change.diff : null;

        if (diff) {
            /*
             * We parse the keys, do some trimming, formatting, and generate a readable message.
             * Note: When the keys "from" or "to" are unavailable, we format the message accordingly.
             *
             * We skip some of these events to keep the messages simple.,
             */

            const ignore_diffs = ['kanban_order', 'description_diff'];

            for (var diffKey in diff) {
                if (diff.hasOwnProperty(diffKey)) {

                    this.do_log("KEY: " + diffKey);

                    if (ignore_diffs.indexOf(diffKey) >= 0) {
                        continue;
                    }

                    var diffValue = diff[diffKey];
                    var diffKeyFormatted = diffKey.replace('_', ' ');

                    this.do_log("Value: " + diffValue);

                    var diffMessageChunk = `\n>`;
                    var diffFrom = '';
                    var diffTo = ''

                    // "diff": {"foobar": {from: "foo", to: "bar"}}
                    if (typeof diffValue == "object") {

                        if (diffValue.hasOwnProperty('from')) {
                            diffFrom = diffValue.from;
                            if (diffFrom.length > 40) {
                                diffFrom = diffFrom.substr(0, 35) + "...";
                            }
                        }

                        if (diffValue.hasOwnProperty('to')) {
                            diffTo = diffValue.to;
                            if (diffTo.length > 40) {
                                diffTo = diffTo.substr(0, 35) + "...";
                            }
                        }
                    }
                    // "diff": {"foobar": "current value"}
                    else if (typeof diffValue == "string") {
                        diffTo = diffValue;
                        if (diffTo.length > 40) {
                            diffTo = diffTo.substr(0, 35) + "...";
                        }
                    }

                    this.do_log("from: " + diffFrom);
                    this.do_log("to: " + diffTo);

                    //
                    if (diffFrom.length + diffTo.length === 0) {
                        diffMessageChunk += `[Changed ${diffKey}]`;
                    } else if (diffFrom.length === 0) {
                        diffMessageChunk += `[Added ${diffKeyFormatted}] ← ${diffTo}`;
                    } else if (diffTo.length === 0) {
                        diffMessageChunk += `[Removed ${diffKey}] → ~${diffFrom}~`;
                    } else {
                        diffMessageChunk += `[Changed ${diffKey}] ~${diffFrom}~ → ${diffTo}`;
                    }

                    itemMeta += diffMessageChunk;
                }
            }
        }

        /*
         * In all types (milestone|task|issue|wikipage) there are three events- 'create', 'change' and 'delete'.
         * There is a lot of code repetition here, so comments are limited to the first occurrence of a code.
         * For each type, create the message and add a link to that item.
         */
        switch (request.content.type) {
            case 'test':
                attachment_title = data.test;
                attachment_link = 'https://example.com/';
                attachment_anchor = `[${attachment_title}](${attachment_link})`

                if (request.content.action === 'test') {
                    message_emoji = ':bell:';
                    message_text = `${author_anchor} sent a test message.`;
                }

                break;
            case 'milestone':
                attachment_title = data.name;
                attachment_link = data.permalink;
                attachment_anchor = `[${attachment_title}](${attachment_link})`

                // Created
                if (request.content.action === 'create') {
                    message_emoji = ':new:';
                    message_text = `${author_anchor} added a new milestone ${attachment_anchor}. ${itemMeta}`;
                    message_text += `\nStart: ${data.estimated_start}, `
                    message_text += `\nFinish: ${data.estimated_finish}`;
                }
                // updated
                else if (request.content.change) {
                    message_emoji = ':triangular_flag_on_post:';
                    message_text = `${author_anchor} updated the milestone ${attachment_anchor} ${itemMeta}`;
                }
                // Deleted
                else {
                    message_emoji = ':x:';
                    message_text = `${author_anchor} deleted a milestone ~${data.name}~. ${itemMeta}`;
                }

                break;


            case 'epic':
            case 'userstory':
            case 'relateduserstory':
            case 'task':
            case 'issue':
            case 'wikipage':
                var contentType = request.content.type
                    .replace('related', 'related ') //added trailing space
                    .replace('userstory', 'user story')
                    .replace('wikipage', 'wiki page');

                attachment_title = data.subject || data.slug || data.user_story.subject || data.epic.subject;
                attachment_link = data.permalink;
                attachment_anchor = attachment_title ? `[${attachment_title}](${attachment_link})` : '';

                // If there is a mention of another "user_story" or "epic",
                // We add the snippet " ...in User Story XYZ" or "in Epic XYZ" in the message
                var user_story_or_epic_mention = ".";
                if (data.user_story) {
                    user_story_or_epic_mention = ` (User Story: [${data.user_story.subject}](${data.user_story.permalink}) ) `;
                }
                if (data.epic) {
                    user_story_or_epic_mention += ` (Epic: [${data.epic.subject}](${data.epic.permalink}) ) `
                }

                // Created
                if (request.content.action === 'create') {
                    message_emoji = ':new:';
                    message_text = `${author_anchor} added a new ${contentType} ${attachment_anchor} ${user_story_or_epic_mention}. ${itemMeta}`;
                }
                // updated
                else if (request.content.change) {

                    // When a comment is added / edited / deleted, "comment" object has non-empty value.
                    if (request.content.change.comment) {

                        // When a comment is deleted, the delete_comment_date is set
                        if (request.content.change.delete_comment_date) {
                            message_emoji = ':x:';
                            message_text = `${author_anchor} deleted their comment on ${contentType}: ${attachment_anchor} ${user_story_or_epic_mention}. ${itemMeta}`;
                        } else {
                            message_emoji = ':speech_balloon:';
                            message_text = `${author_anchor} commented on ${contentType}: ${attachment_anchor} ${user_story_or_epic_mention}. ${itemMeta}`;
                        }
                        message_text += `\n> ${request.content.change.comment.split('\n', 1)[0]}`;
                    }

                    // Comment is empty, that means something else was changed.
                    else {
                        message_emoji = ':triangular_flag_on_post:';
                        message_text += `${author_anchor} updated the ${contentType}: ${attachment_anchor} ${user_story_or_epic_mention}. ${itemMeta}`;
                    }
                }
                // Deleted
                else {
                    message_emoji = ':x:';
                    message_text = `${author_anchor} deleted the ${contentType}: ~${attachment_title}~ ${user_story_or_epic_mention}. ${itemMeta}`;
                }

                break;

            default:
                break;
        }

        var returnData = {
            content: {
                // text: `${message_emoji} ${message_text}`,
                text: `${message_text}`,
                alias: sender_name,
                icon_url: sender_icon,
                // "attachments": [{
                //   "color": "#00bb99",
                //   "title": attachment_title,
                //   "title_link": attachment_link,
                //   "text": message_text + "\n" + attachment_text,
                // }]
            }
        };

        // Comment in prod.
        this.do_log("\n\n------- START MESSAGE -------\n");
        this.do_log(returnData);
        this.do_log("\n--------END MESSAGE ------\n\n");

        return returnData;
    }
}
