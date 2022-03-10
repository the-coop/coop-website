const filteredRoles = ['SOCIAL', 'MEMBER', 'LOGS', 'GAMING', 'PROJECTS', 'CONQUEST', 'SUBSCRIBER', 'GUIDE', 'KEY_INFO'];

export default class MembersUIHelper {
    static decorate(role) {
        const Replaced = role.replace(/_/g, ' ');
        if (role === 'COMMANDER') return '👑 ' + Replaced;
        if (role === 'LEADER') return '🗡️ ' + Replaced;
        if (role === 'MOTW') return '🏅 ' + 'MOTW';
        if (role === 'PROSPECT') return '🐣 ' + Replaced;
        if (role === 'MOSTPOINTS') return '🚀 ' + Replaced;
        if (role === 'RICHEST') return '💰 ' + Replaced;
        
        return Replaced;
    }
    static filter(roles) {
        return roles.filter(role => !filteredRoles.includes(role));
    }
}
